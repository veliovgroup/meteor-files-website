import fs from 'node:fs';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { FSStorage } from 'meteor/ostrio:files';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * @class S3Storage
 * @summary ostrio:files v4 storage adapter. Copies finished uploads to AWS:S3 and serves them from there.
 * Falls back to the local file when the upload to S3 failed, and for documents stored before v4
 * (v3 kept the S3 key at `versions.<name>.meta.pipePath`)
 * @see https://github.com/veliovgroup/Meteor-Files/blob/master/docs/aws-s3-integration.md
 */
export class S3Storage {
  /**
   * @param {object} opts
   * @param {object} opts.conf - `{ key, secret, bucket, region, endpoint? }`, `endpoint` for S3-compatible services (MinIO, Wasabi, etc.)
   * @param {string} [opts.prefix] - Key prefix inside the bucket
   */
  constructor({ conf, prefix = 'files/' }) {
    this.name = 's3';
    this.bucket = conf.bucket;
    this.prefix = prefix;
    this.local = new FSStorage();
    const clientConf = {
      region: conf.region,
      maxAttempts: 5,
      credentials: {
        accessKeyId: conf.key,
        secretAccessKey: conf.secret
      }
    };

    if (conf.endpoint) {
      clientConf.endpoint = conf.endpoint;
      clientConf.forcePathStyle = true;
    }

    this.client = new S3Client(clientConf);
  }

  /**
   * @summary S3 key of a version, `null` when the version lives on the local file system
   * @returns {string|null}
   */
  _key(fileRef, versionName) {
    const meta = fileRef?.versions?.[versionName]?.meta;
    return meta?.storage?.key || meta?.pipePath || null;
  }

  async put(fileRef, versionName, localPath, { source } = {}) {
    const vRef = fileRef.versions[versionName];
    // Random key instead of the file's `_id`, so the bucket listing does not
    // reveal links to unlisted and protected files
    const key = `${this.prefix}${Random.id()}-${versionName}${fileRef.extensionWithDot || ''}`;

    try {
      const { size } = await fs.promises.stat(localPath);
      await this.client.send(new PutObjectCommand({
        StorageClass: 'STANDARD',
        Bucket: this.bucket,
        Key: key,
        Body: fs.createReadStream(localPath),
        ContentLength: size,
        ContentType: vRef?.type || fileRef.type
      }));
    } catch (error) {
      // Keep the local file and serve it from the file system
      console.error('[S3Storage] [put] File was not uploaded to S3, serving it from FS', fileRef._id, error);
      return { name: 'fs' };
    }

    // Files passed to `addFile()` belong to the caller
    if (source !== 'addFile') {
      try {
        await fs.promises.unlink(localPath);
      } catch (error) {
        console.warn('[S3Storage] [put] Can not unlink local copy', localPath, error);
      }
    }

    return { name: 's3', bucket: this.bucket, key };
  }

  async stat(fileRef, versionName) {
    if (this._key(fileRef, versionName)) {
      return { size: fileRef.versions[versionName].size };
    }
    return this.local.stat(fileRef, versionName);
  }

  async createReadStream(fileRef, versionName, { start, end } = {}) {
    const key = this._key(fileRef, versionName);
    if (!key) {
      return this.local.createReadStream(fileRef, versionName, { start, end });
    }

    try {
      const res = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: Number.isInteger(start) ? `bytes=${start}-${end}` : undefined
      }));
      return res.Body;
    } catch (error) {
      console.error('[S3Storage] [createReadStream] Error:', fileRef._id, key, error);
      throw new Meteor.Error(404, 'File not found');
    }
  }

  async remove(fileRef, versionName) {
    const key = this._key(fileRef, versionName);
    if (!key) {
      return this.local.remove(fileRef, versionName);
    }

    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /**
   * @summary Check WRITE, READ, and REMOVAL access to the bucket. Logs the result
   * @returns {Promise<boolean>}
   */
  async selfTest() {
    const Key = `test-file-${Random.id()}.txt`;
    const steps = [
      ['WRITE (PutObject)', () => new PutObjectCommand({ Bucket: this.bucket, Key, Body: Buffer.from('text text file', 'utf8') })],
      ['READ (GetObject)', () => new GetObjectCommand({ Bucket: this.bucket, Key })],
      ['REMOVAL (DeleteObject)', () => new DeleteObjectCommand({ Bucket: this.bucket, Key })]
    ];

    for (const [access, command] of steps) {
      try {
        const res = await this.client.send(command());
        // Drain the GetObject body, so the socket returns to the pool
        await res.Body?.transformToString?.();
      } catch (error) {
        console.error(`Achtung! No ${access} access to AWS:S3 storage`, error);
        return false;
      }
    }

    Meteor._debug('Meteor Files App: AWS integration SUCCESSFULLY tested');
    return true;
  }
}
