import { Meteor } from 'meteor/meteor';
import { moment } from 'meteor/momentjs:moment';
import { filesize } from 'meteor/mrt:filesize';
import { Template } from 'meteor/templating';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { ReactiveVar } from 'meteor/reactive-var';
import { _app, Collections } from '/imports/lib/core.js';

import { webPush } from '/imports/client/misc/web-push.js';
import '/imports/client/upload/upload-form.sass';
import '/imports/client/upload/upload-form.jade';

const formError = new ReactiveVar(false);

/**
 * Read a file from FileSystemFileEntry in async way
 * @function readWebkitEntry
 * @param {FileSystemFileEntry} entry - FileSystemEntry with .isDirectory === true returned from non-standard `.webkitGetAsEntry()` method
 * @returns {Promise}
 */
const readWebkitEntry = (entry) => {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
};

/**
 * Recursively read directory and enclosed directories
 * Using non-standard `.entries()` and `.createReader()` APIs for compatibility
 * As of 2020-02-02 this approach works in FireFox, Safari, and Chrome
 * @function getFilesFromDirectory
 * @param {DataTransferItem|FileSystemFileEntry} directory - Directory selected by user in `drop` event
 * @param {Boolean} isWebKit - `true` if directory returned from `.webkitGetAsEntry()` method
 * @returns {[File]} - Array of File instances
 */
const getFilesFromDirectory = async (directory, isWebKit = false) => {
  let files = [];
  try {
    if (isWebKit) {
      if (typeof directory.createReader === 'function') {
        files = await readWebkitEntries(directory.createReader());
      }
    } else {
      for await (const [name, entry] of directory.entries()) {
        if (name.startsWith('.') || entry.name.startsWith('.')) {
          continue;
        } else if (entry.kind === 'file') {
          files.push(await entry.getFile());
        } else if (entry.kind === 'directory') {
          files = files.concat(await getFilesFromDirectory(entry));
        }
      }
    }
  } catch (e) {
    // SOMENTHING ISN'T FULLY SUPPORTED YET...
    console.error(e);
  }

  return files;
};

/**
 * Recursively read entries returned freom reader created by `.webkitGetAsEntry().createReader()` method
 * @function readWebkitEntries
 * @param {FileSystemDirectoryReader} reader - reader created by `.webkitGetAsEntry().createReader()` method
 * @returns {Promise}
 */
function readWebkitEntries(reader) {
  let files = [];
  return new Promise((resolve, reject) => {
    reader.readEntries(async (entries) => {
      for (const entry of entries) {
        if (entry.isFile && !entry.name.startsWith('.')) {
          files.push(await readWebkitEntry(entry));
        } else if (entry.isDirectory) {
          files = files.concat(await getFilesFromDirectory(entry, true));
        }
      }
      resolve(files);
    }, reject);
  });
}

Template.uploadForm.onCreated(function () {
  const template = this;
  this.uploadQTY = 0;
  this.heatingUp = new ReactiveVar(false);

  this.initiateUpload = async (event, files) => {
    if (_app.uploads.get()) {
      return false;
    }

    if (!files.length) {
      formError.set('Please select a file to upload');
      return false;
    }

    if (files.length > Meteor.settings.public.maxFilesQty) {
      formError.set(`Please select up to ${Meteor.settings.public.maxFilesQty} files`);
      return false;
    }

    if (this.errorTimer) {
      clearTimeout(this.errorTimer);
      this.errorTimer = null;
    }

    this.uploadQTY = files.length;
    const cleanUploaded = (current) => {
      template.heatingUp.set(false);

      const _uploads = _app.clone(_app.uploads.get());
      if (_app.isArray(_uploads)) {
        for (let i = 0; i < _uploads.length; i++) {
          if (_uploads[i].file.name === current.file.name) {
            _uploads.splice(i, 1);
            if (_uploads.length) {
              _app.uploads.set(_uploads);
            } else {
              this.uploadQTY = 0;
              _app.uploads.set(false);
            }
          }
        }
      }
    };

    const uploads = [];
    const createdAt = +new Date();

    this.heatingUp.set(true);
    // ASK IF USER OKAY WITH WEB PUSH NOTIFICATIONS
    // GET subscription IF PERMISSION IS GRANTED
    await webPush.check();

    // ITEREATE OVER EACH SELECTED FILE BY USER.
    // AND UPLOAD EACH FILE INDIVIDUALLY.
    // INSIDE `.on('start')` EVENT WE GET {FileUpload}
    // INSTANCE AND PUSH IT TO `uploads` {ReactiveVar} ARRAY.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      Collections.files.insert({
        file: file,
        meta: {
          blamed: 0,
          expireAt: +new Date(createdAt + _app.conf.fileTTL),
          createdAt,
          subscription: webPush.subscription || void 0 // <-- This is the place where we send Web Push Notification subscription to a server
        },
        chunkSize: 'dynamic',
        transport: _app.conf.uploadTransport.get()
      }, false).on('end', function (error, fileObj) {
        if (!error) {
          // PUSH NEWLY UPLOADED FILE TO PERSISTENT COLLECTION
          Collections._files.insert(fileObj);

          if (files.length === 1) {
            setTimeout(() => {
              FlowRouter.go('file', { _id: fileObj._id });
            }, 128);
          }
        }
        cleanUploaded(this);
      }).on('abort', function () {
        cleanUploaded(this);
      }).on('error', function (error) {
        let currentError = formError.get() || '';
        if (currentError.length) {
          currentError += '<br/>';
        }
        formError.set(`${currentError}${this.file.name}: ${_app.isObject(error) ? error.reason : error}`);
        this.errorTimer = setTimeout( () => {
          formError.set(false);
        }, 15000);
        cleanUploaded(this);
      }).on('start', function() {
        template.heatingUp.set(false);
        uploads.push(this);
        _app.uploads.set(uploads);
      }).start();
    }
    return true;
  };
});

Template.uploadForm.helpers({
  error() {
    return formError.get();
  },
  uploads() {
    return _app.uploads.get();
  },
  isHeatingUp() {
    return Template.instance().heatingUp.get() && !_app.uploads.get().length;
  },
  isDisconnected() {
    return !Meteor.status().connected;
  },
  status() {
    let i = 0;
    let progress = 0;
    let onPause = false;
    const uploads = _app.uploads.get();
    const uploadQTY = Template.instance().uploadQTY;
    let accumBitrate = 0;
    let accumDuration = 0;

    // ITERATE OVER UPLOADS {ReactiveVar} TO
    // ESTIMATE TOTAL SPEED AND UPLOAD ETA
    if (uploads) {
      for (let j = 0; j < uploads.length; j++) {
        onPause = uploads[j].onPause.get();
        progress += uploads[j].progress.get();
        accumBitrate += uploads[j].estimateSpeed.get();
        accumDuration += uploads[j].estimateTime.get();
        i++;
      }

      if (i < uploadQTY) {
        progress += 100 * (uploadQTY - i);
      }

      progress = Math.ceil(progress / uploadQTY);
      accumBitrate = filesize(Math.ceil(accumBitrate / i), { bits: true }) + '/s';
      accumDuration = (() => {
        const duration = moment.duration(Math.ceil(accumDuration / i));
        let hours = `${duration.hours()}`;
        if (hours.length <= 1) {
          hours = `0${hours}`;
        }

        let minutes = `${duration.minutes()}`;
        if (minutes.length <= 1) {
          minutes = `0${minutes}`;
        }

        let seconds = `${duration.seconds()}`;
        if (seconds.length <= 1) {
          seconds = `0${seconds}`;
        }
        return `${hours}:${minutes}:${seconds}`;
      })();
    }

    return { progress, accumBitrate, accumDuration, onPause };
  }
});

Template.uploadForm.events({
  'click [data-pause-all]'(e) {
    e.preventDefault();
    const uploads = _app.uploads.get();
    if (uploads) {
      for (let j = 0; j < uploads.length; j++) {
        uploads[j].pause();
      }
    }
    return false;
  },
  'click [data-abort-all]'(e) {
    e.preventDefault();
    const uploads = _app.uploads.get();
    if (uploads) {
      for (let j = 0; j < uploads.length; j++) {
        uploads[j].abort();
      }
    }
    formError.set(false);
    return false;
  },
  'click [data-continue-all]'(e) {
    e.preventDefault();
    const uploads = _app.uploads.get();
    if (uploads) {
      for (let j = 0; j < uploads.length; j++) {
        uploads[j].continue();
      }
    }
    return false;
  },
  'click #fakeUpload'(e, template) {
    e.preventDefault();
    template.$('#userfile').trigger('click');
    return false;
  },
  'dragover #uploadFile, dragenter #uploadFile'(e) {
    e.preventDefault();
    e.stopPropagation();
    _app.isFileOver.set(true);
    e.originalEvent.dataTransfer.dropEffect = 'copy';
  },
  async 'drop #uploadFile.file-over'(e, template) {
    e.preventDefault();
    e.stopPropagation();
    _app.isFileOver.set(false);
    e.originalEvent.dataTransfer.dropEffect = 'copy';

    formError.set(false);
    let files = [];
    let i = -1;
    for (const file of e.originalEvent.dataTransfer.files) {
      i++;
      // FILTER ZERO-SIZE FILES AND DETECT DIRS
      // DIRECTORIES WON'T HAVE MIME-TYPE
      if (file.size > 0 && file.type) {
        files.push(file);
      } else if (e.originalEvent.dataTransfer?.items?.[i]) {
        const item = e.originalEvent.dataTransfer.items[i];

        let entry = {};
        if (typeof item.webkitGetAsEntry === 'function') {
          entry = item.webkitGetAsEntry();
        } else if (typeof item.getAsFileSystemHandle === 'function') {
          entry = await item.getAsFileSystemHandle();
        }

        if (entry.kind === 'directory' || entry.isDirectory) {
          files = files.concat(await getFilesFromDirectory(entry, entry.isDirectory));
        }
      }
    }

    template.initiateUpload(e, files, template);
    return false;
  },
  'change #userfile'(e, template) {
    template.$('form#uploadFile').submit();
  },
  'submit form#uploadFile'(e, template) {
    e.preventDefault();
    formError.set(false);
    template.initiateUpload(e, e.currentTarget.userfile.files);
    return false;
  },
  'click [data-cancel-dnd]'(e) {
    e.preventDefault();
    _app.isFileOver.set(false);
    return false;
  }
});
