import { Meteor } from 'meteor/meteor';
import { filesize } from 'meteor/mrt:filesize';
import { FilesCollection, helpers as filesHelpers } from 'meteor/ostrio:files';
import { _app, Collections } from '/imports/lib/core.js';
import { webPush } from '/imports/server/web-push.js';
import { S3Storage } from '/imports/server/s3-storage.js';

// AWS:S3 usage:
// Read: https://github.com/veliovgroup/Meteor-Files/blob/master/docs/aws-s3-integration.md
// env.var example: S3='{"s3":{"key": "xxx", "secret": "xxx", "bucket": "xxx", "region": "xxx"}}'
// optional "endpoint" in "s3" object for S3-compatible services (MinIO, Wasabi)
if (process.env.S3) {
  Meteor.settings.app.s3 = JSON.parse(process.env.S3).s3;
}

if (!Meteor.settings.debug) {
  Meteor.settings.debug = process.env.DEBUG === 'true' ? true : false;
}

const s3Conf = Meteor.settings.app.s3 || {};
let storage;

if (s3Conf.key && s3Conf.secret && s3Conf.bucket && s3Conf.region) {
  // UPLOADS ARE WRITTEN TO `storagePath` FIRST,
  // THEN `storage.put()` MOVES FINISHED FILES TO AWS:S3.
  // `serve()` STREAMS FROM S3 (WITH RANGE SUPPORT) AND
  // `removeAsync()` REMOVES FILES FROM S3
  storage = new S3Storage({ conf: s3Conf, prefix: 'files/' });

  // TEST WRITE/READ/REMOVAL ACCESS TO AWS:S3 ENDPOINT
  storage.selfTest();
}

// CREATE `FilesCollection` INSTANCE`
Collections.files = new FilesCollection({
  debug: Meteor.settings.debug,
  continueUploadTTL: Meteor.settings.app.continueUploadTTL, // Limit upload to X seconds (by default 3 hours)
  storagePath: Meteor.settings.app.storagePath || 'assets/app/uploads/uploadedFiles',
  collectionName: 'uploadedFiles',
  allowClientCode: false,
  // `undefined` FALLS BACK TO DEFAULT `FSStorage`
  storage,
  // disableUpload: true, // DISABLE UPLOAD FROM CLIENT, MANAGE ALL FILES FROM SERVER
  // disableDownload: true, // DISABLE DOWNLOAD
  // protected: true, // Allow to read by any authorized user
  async protected(fileObj) {
    if (fileObj?.userId) {
      // DO NOT SERVE "OWNED" FILES TO UNAUTHORIZED USERS
      if (!this.userId) {
        return false;
      }

      // DO NOT SERVE "OWNED" FILES TO OTHER USERS
      if (fileObj.userId !== this.userId) {
        return false;
      }

      // TOGGLE FILE PRIVACY VIA `meta.secured` FLAG
      // if (!(fileObj.meta && fileObj.meta.secured)) {
      //   return true;
      // } else if ((fileObj.meta && fileObj.meta.secured === true) && this.userId === fileObj.userId) {
      //   return true;
      // }
    }
    return true;
  },
  sanitize(str = ''/*, max = 28, replacement = '-'*/) {
    // REPLACE DEFAULT sanitize METHOD TO ALLOW:
    // - File System names / _id(s) up to 40 chars long
    // - "not allowed characters" will be replaced with 'f' char
    return filesHelpers.sanitize(str, 40, 'f');
  },
  namingFunction({ fileId }) {
    // Name files on FS by the server-generated `_id`, the client can't pick the name
    // Use `this.sanitize` method to utilize `sanitize` function passed into FilesCollection constructor above
    return this.sanitize(fileId);
  },
  onBeforeUpload() {
    if (this.file.size <= _app.conf.maxFileSize) {
      return true;
    }
    return `Max. file size is ${filesize(_app.conf.maxFileSize).replace('.00', '')} you've tried to upload ${filesize(this.file.size)}`;
  }
});

// DISALLOD REMOVE AND UPDATE FROM CLIENT
Collections.files.denyClient();

// NOTIFY UPLOADER VIA WEB PUSH AFTER UPLOAD,
// FILES ARE ALREADY MOVED TO STORAGE (S3) BEFORE THIS EVENT
Collections.files.on('afterUpload', async function (fileRef) {
  const webPushSubscription = fileRef.meta?.subscription;
  if (!webPushSubscription) {
    return;
  }

  webPush.send(webPushSubscription, {
    title: `File: ${fileRef.name}`,
    body: 'Successfully uploaded. Click to view',
    data: {
      url: `/f/${fileRef._id}`
    }
  });

  try {
    await this.collection.updateAsync({ _id: fileRef._id }, {
      $unset: {
        'meta.subscription': ''
      }
    });
  } catch (error) {
    console.error('[afterUpload] [unset meta.subscription] Error:', fileRef._id, error);
  }
});

// Set necessary indexes
await Collections.files.collection.createIndexAsync({ 'meta.expireAt': 1 });
await Collections.files.collection.createIndexAsync({ userId: 1, 'meta.createdAt': -1 });
await Collections.files.collection.createIndexAsync({ _id: 1, 'meta.createdAt': -1 });

// Every two minutes (120000ms) check for files which is about to expire
// Remove files along with MongoDB records two minutes before expiration date
// Note: having 'expireAfterSeconds' index on 'meta.expireAt' field, won't remove file itself
Meteor.setInterval(async () => {
  await Collections.files.removeAsync({
    'meta.expireAt': {
      $lte: Date.now() + 120000
    }
  });
}, 120000);
