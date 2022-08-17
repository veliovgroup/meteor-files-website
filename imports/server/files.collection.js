import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { filesize } from 'meteor/mrt:filesize';
import { FilesCollection, helpers as filesHelpers } from 'meteor/ostrio:files';
import { _app, Collections } from '/imports/lib/core.js';
import { webPush } from '/imports/server/web-push.js';

import fs from 'fs-extra';
import S3 from 'aws-sdk/clients/s3';

// AWS:S3 usage:
// Read: https://github.com/VeliovGroup/Meteor-Files/wiki/AWS-S3-Integration
// env.var example: S3='{"s3":{"key": "xxx", "secret": "xxx", "bucket": "xxx", "region": "xxx""}}'
let useS3 = false;
let client;

const bound = Meteor.bindEnvironment((callback) => {
  return callback();
});

if (process.env.S3) {
  Meteor.settings.s3 = JSON.parse(process.env.S3).s3;
}

if (!Meteor.settings.debug) {
  Meteor.settings.debug = process.env.DEBUG === 'true' ? true : false;
}

const s3Conf = Meteor.settings.s3 || {};

if (s3Conf && s3Conf.key && s3Conf.secret && s3Conf.bucket && s3Conf.region) {
  useS3  = true;

  /* AWS:S3 CLIENT INSTANCE
   * @type {AWS.Service}
   * @instanceof AWS.Service
   * @name client
   */
  const s3ConnectionTimeout = 6000000;
  const s3Retries = 4;
  client = new S3({
    secretAccessKey: s3Conf.secret,
    accessKeyId: s3Conf.key,
    region: s3Conf.region,
    maxRetries: s3Retries,
    sslEnabled: false,
    correctClockSkew: true,
    httpOptions: {
      connectTimeout: s3ConnectionTimeout,
      timeout: s3ConnectionTimeout * s3Retries
    }
  });

  // TEST WRITE/READ/REMOVAL ACCESS TO AWS:S3 ENDPOINT
  const rndmName = Random.id();
  client.putObject({
    Bucket: s3Conf.bucket,
    Key: `test-file-${rndmName}.txt`,
    Body: Buffer.from('text text file', 'utf8')
  }, (awsWriteError) => {
    bound(() => {
      if (awsWriteError) {
        throw new Meteor.Error(500, 'Achtung! No WRITE (`putObject`) access to AWS:S3 storage', awsWriteError);
      } else {
        client.getObject({
          Bucket: s3Conf.bucket,
          Key: `test-file-${rndmName}.txt`,
        }, (awsReadError) => {
          bound(() => {
            if (awsReadError) {
              throw new Meteor.Error(500, 'Achtung! No READ (`getObject`) access to AWS:S3 storage', awsReadError);
            } else {
              client.deleteObject({
                Bucket: s3Conf.bucket,
                Key: `test-file-${rndmName}.txt`,
              }, (awsRemoveError) => {
                bound(() => {
                  if (awsRemoveError) {
                    throw new Meteor.Error(500, 'Achtung! No REMOVAL (`deleteObject`) access to AWS:S3 storage', awsRemoveError);
                  } else {
                    Meteor._debug('Meteor Files App: AWS integration SUCCESSFULLY tested');
                  }
                });
              });
            }
          });
        });
      }
    });
  });
}

Collections.files = new FilesCollection({
  debug: Meteor.settings.debug,
  continueUploadTTL: 32400, // Limit upload to 9 hours (by default 3 hours), since we allow 3GB in our demo app, it might take time on slow connection to upload it
  storagePath: Meteor.settings.storagePath || 'assets/app/uploads/uploadedFiles',
  collectionName: 'uploadedFiles',
  allowClientCode: false,
  // disableUpload: true,
  // disableDownload: true,
  sanitize(str = ''/*, max = 28, replacement = '-'*/) {
    // REPLACE DEFAULT sanitize METHOD TO ALLOW:
    // - File System names / _id(s) up to 40 chars long
    // - "not allowed characters" will be replaced with 'f' char
    return filesHelpers.sanitize(str, 40, 'f');
  },
  namingFunction({ file }) {
    // Override client's `namingFunction` for security reasons against reverse-engineering
    // Use `this.sanitize` method to utilize `sanitize` function passed into FilesCollection constructor above
    return this.sanitize(file._id);
  },
  onBeforeUpload() {
    if (this.file.size <= _app.conf.maxFileSize) {
      return true;
    }
    return `Max. file size is ${filesize(_app.conf.maxFileSize).replace('.00', '')} you've tried to upload ${filesize(this.file.size)}`;
  },
  interceptDownload(http, fileRef, version) {
    let path;
    if (useS3) {
      path = (fileRef && fileRef.versions && fileRef.versions[version] && fileRef.versions[version].meta && fileRef.versions[version].meta.pipePath) ? fileRef.versions[version].meta.pipePath : void 0;
      if (path) {
        // If file is successfully moved to Storage
        // We will pipe request to Storage
        // So, original link will stay always secure

        // To force ?play and ?download parameters
        // and to keep original file name, content-type,
        // content-disposition and cache-control
        // we're using low-level .serve() method
        const opts = {
          Bucket: s3Conf.bucket,
          Key: path
        };

        if (http.request.headers.range) {
          const vRef = fileRef.versions[version];
          let range = _app.clone(http.request.headers.range);
          const array = range.split(/bytes=([0-9]*)-([0-9]*)/);
          const start = parseInt(array[1]);
          let end = parseInt(array[2]);

          if (isNaN(end)) {
            // Request data from AWS:S3 by small chunks
            end = (start + this.chunkSize) - 1;
            if (end >= vRef.size) {
              end = vRef.size - 1;
            }
          }

          opts.Range = `bytes=${start}-${end}`;
          http.request.headers.range = `bytes=${start}-${end}`;
        }

        const responseEnd = (error) => {
          bound(() => {
            if (error) {
              console.error('[interceptDownload] [responseEnd]', error);
            }

            if (!http.response.finished) {
              http.response.end();
            }
          });
        };

        const awsStream = client.getObject(opts).createReadStream();
        awsStream.on('error', responseEnd);

        this.serve(http, fileRef, fileRef.versions[version], version, awsStream);
        return true;
      }
      // While file is not yet uploaded to Storage
      // We will serve file from FS
      return false;
    }
    return false;
  }
});

Collections.files.denyClient();
Collections.files.on('afterUpload', function(fileRef) {
  const messageObj = {
    title: `File: ${fileRef.name}`,
    body: 'Successfully uploaded. Click to view',
    data: {
      url: `/f/${fileRef._id}`
    }
  };

  let webPushSubscription = false;
  if (fileRef.meta.subscription) {
    webPushSubscription = fileRef.meta.subscription;
  }

  if (useS3) {
    for(let version in fileRef.versions) {
      if (fileRef.versions[version]) {
        const vRef = fileRef.versions[version];
        // We use Random.id() instead of real file's _id
        // to secure files from reverse engineering
        // As after viewing this code it will be easy
        // to get access to unlisted and protected files
        const filePath = `files/${Random.id()}-${version}.${fileRef.extension}`;

        client.putObject({
          StorageClass: 'STANDARD',
          Bucket: s3Conf.bucket,
          Key: filePath,
          Body: fs.createReadStream(vRef.path),
          ContentType: vRef.type,
        }, (error) => {
          bound(() => {
            if (error) {
              console.error('[afterUpload] [putObject] Error:', error);
            } else {
              const upd = {
                $set: {
                  [`versions.${version}.meta.pipePath`]: filePath
                }
              };

              if (webPushSubscription) {
                upd.$unset = {
                  'meta.subscription': ''
                };
              }

              this.collection.update({
                _id: fileRef._id
              }, upd, (updError) => {
                if (updError) {
                  console.error('[afterUpload] [putObject] [collection.update] Error:', updError);
                } else {
                  // Unlink original file from FS
                  // after successful upload to AWS:S3
                  this.unlink(this.collection.findOne(fileRef._id), version);
                  if (webPushSubscription) {
                    webPush.send(webPushSubscription, messageObj);
                  }
                }
              });
            }
          });
        });
      }
    }
  } else if (webPushSubscription) {
    webPush.send(webPushSubscription, messageObj);
    Collections.files.collection.update({
      _id: fileRef._id
    }, {
      $unset: {
        'meta.subscription': ''
      }
    });
  }
});

// Set index on 'meta.expireAt' field
Collections.files.collection._ensureIndex({ 'meta.expireAt': 1 }, { background: true });

// Intercept FileCollection's remove method
// to remove file from AWS S3
if (useS3) {
  const _origRemove = Collections.files.remove;
  Collections.files.remove = function(search) {
    const cursor = this.collection.find(search);
    cursor.forEach((fileRef) => {
      for (let version in fileRef.versions) {
        if (fileRef.versions[version]) {
          const vRef = fileRef.versions[version];
          if (vRef && vRef.meta && vRef.meta.pipePath) {
            client.deleteObject({
              Bucket: s3Conf.bucket,
              Key: vRef.meta.pipePath,
            }, (error) => {
              bound(() => {
                if (error) {
                  console.error('[remove] [deleteObject] Error:', error);
                }
              });
            });
          }
        }
      }
    });
    // Call original method
    _origRemove.call(this, search);
  };
}

// Every two minutes (120000ms) check for files which is about to expire
// Remove files along with MongoDB records two minutes before expiration date
// Note: having 'expireAfterSeconds' index on 'meta.expireAt' field, won't remove file itself
Meteor.setInterval(() => {
  Collections.files.remove({
    'meta.expireAt': {
      $lte: Date.now() + 120000
    }
  }, _app.noop);
}, 120000);
