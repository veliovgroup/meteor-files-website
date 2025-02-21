import { _app } from '/imports/lib/core.js';
import { Meteor } from 'meteor/meteor';
import { filesize } from 'meteor/mrt:filesize';
import { Collections } from '/imports/lib/core.js';
import { FilesCollection } from 'meteor/ostrio:files';
import { persistentReactive } from '/imports/client/misc/persistent-reactive.js';

// STORE ARRAY OF _id OF RECENTLY UPLOADED FILES FOR SERVER SUBSCRIPTION
_app.conf.recentUploads = persistentReactive('recentUploads', []);

// ITERATE OVER CACHED _id TO REMOVE EXPIRED FILES
const recentUploads = _app.conf.recentUploads.get();
if (recentUploads && recentUploads.length) {
  const now = Date.now();
  const expired = [];
  recentUploads.forEach((fileRef, i) => {
    if (fileRef.meta && fileRef.meta.expireAt < now) {
      expired.push(i);
    }
  });

  if (expired.length) {
    expired.forEach((expiredIndex) => {
      recentUploads.splice(expiredIndex, 1);
    });

    _app.conf.recentUploads.set(recentUploads);
  }
}

Collections.files = new FilesCollection({
  debug: Meteor.settings.public.debug || false,
  collectionName: 'uploadedFiles',
  allowClientCode: false,
  // disableUpload: true,
  onBeforeUpload() {
    if (this.file.size <= _app.conf.maxFileSize) {
      return true;
    }
    return `Max. file size is ${filesize(_app.conf.maxFileSize).replace('.00', '')} you've tried to upload ${filesize(this.file.size)}`;
  }
});
