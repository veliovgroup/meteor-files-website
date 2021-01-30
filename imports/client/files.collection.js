import { _app } from '/imports/lib/core.js';
import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { filesize } from 'meteor/mrt:filesize';
import { Collections } from '/imports/lib/core.js';
import { FilesCollection } from 'meteor/ostrio:files';
import { persistentReactive } from '/imports/client/misc/persistent-reactive.js';

Collections._files = new Mongo.Collection(null);
// SET NAME FOR LOCAL COLLECTION,
// OTHERWISE IT WON'T COOP WITH METEOR-FILES
Collections._files._name = 'uploadedFiles';

// EXTEND `.insert()` METHOD OF LOCAL `._files` COLLECTION
// WITH PERSISTENT STORAGE OPTION
const origInsert = Collections._files.insert;
// EXTEND `_app.conf.recentUploads` with `.add()`
// METHOD KEEPING ONLY 100 MOST RECENT RECORDS
// INSERT RECORD TO THE PERSISTENT STORAGE
Collections._files.insert = function (fileObj) {
  const recentUploads = _app.conf.recentUploads.get();
  if (recentUploads.length >= 100) {
    recentUploads.shift();
  }

  recentUploads.push(fileObj);
  _app.conf.recentUploads.set(recentUploads);
  origInsert.call(Collections._files, fileObj);
};

// UPON INITIAL LOAD:
// GET RECENTLY UPLOADED/SEEN FILES FROM PERSISTENT STORAGE
// ITERATE OVER FILE RECORDS TO EXCLUDE EXPIRED AND PUSH THE
// REST OF THE RECORDS TO `._files` COLLECTION
_app.conf.recentUploads = persistentReactive('recentUploads', []);
const _recentUploads = _app.conf.recentUploads.get();
if (_recentUploads && _recentUploads.length) {
  const now = Date.now();
  const expired = [];
  _recentUploads.forEach((fileRef, i) => {
    if (fileRef.meta && fileRef.meta.expireAt < now) {
      expired.push(i);
    } else if (!Collections._files.findOne(fileRef._id)) {
      origInsert.call(Collections._files, fileRef);
    }
  });

  if (expired.length) {
    expired.forEach((expiredIndex) => {
      _recentUploads.splice(expiredIndex, 1);
    });

    _app.conf.recentUploads.set(_recentUploads);
  }
}

Collections.files = new FilesCollection({
  debug: Meteor.settings.public.debug || false,
  collection: Collections._files, // <-- PASS LOCAL MINI-MONGO COLLECTION ON THE CLIENT __ONLY__
  allowClientCode: false,
  // disableUpload: true,
  onBeforeUpload() {
    if (this.file.size <= _app.conf.maxFileSize) {
      return true;
    }
    return `Max. file size is ${filesize(_app.conf.maxFileSize).replace('.00', '')} you've tried to upload ${filesize(this.file.size)}`;
  }
});
