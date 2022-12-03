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
// LIST OF FILES WE DON'T WANT TO UPLOAD WHEN RECURSIVELY READING A DIRECTORY
const SYSTEM_HIDDEN_FILES = ['.DS_Store', 'Thumbs.db'];
const NOT_SUPPORTED_MSG = 'Directory upload not supported by this browser';

/**
 * Extend Directory Object with `.fullPath` property
 * @function setDirFullPath
 * @param {Object} directory - Directory Object
 * @returns {void 0}
 */
const setDirFullPath = (directory) => {
  if (directory.fullPath) {
    directory.fullPath += `/${directory.name}`;
  } else {
    directory.fullPath = `/${directory.name}`;
  }
};

/**
 * Extend File with `.fullPath` property
 * @function setFileFullPath
 * @param {Object} directory - File's parent directory or empty Object
 * @param {Object} file - File object
 * @returns {void 0}
 */
const setFileFullPath = (directory, file) => {
  file.fullPath = `${directory.fullPath || `/${directory.name}` || ''}/${file.name}`;
};

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
  setDirFullPath(directory);
  let files = [];
  if (isWebKit) {
    if (typeof directory.createReader === 'function') {
      const reader = directory.createReader();
      reader.fullPath = directory.fullPath;
      files = await readWebkitEntries(reader);
    }
  } else {
    for await (const [name, entry] of directory.entries()) {
      if (SYSTEM_HIDDEN_FILES.includes(name) || SYSTEM_HIDDEN_FILES.includes(entry.name) || name.startsWith('._.') || entry.name.startsWith('._.')) {
        // IGNORE SYSTEM FILES
        continue;
      } else if (entry.kind === 'file') {
        const file = await entry.getFile();
        setFileFullPath(directory, file);
        files.push(file);
      } else if (entry.kind === 'directory') {
        entry.fullPath = directory.fullPath;
        files = files.concat(await getFilesFromDirectory(entry));
      }
    }
  }

  return files;
};

/**
 * Recursively read entries returned from reader created by `.webkitGetAsEntry().createReader()` method
 * @function readWebkitEntries
 * @param {FileSystemDirectoryReader} reader - reader created by `.webkitGetAsEntry().createReader()` method
 * @returns {Promise}
 */
function readWebkitEntries(reader) {
  let files = [];
  return new Promise((resolve, reject) => {
    reader.readEntries(async (entries) => {
      for (const entry of entries) {
        if (entry.isFile) {
          // IGNORE SYSTEM FILES
          if (!SYSTEM_HIDDEN_FILES.includes(entry.name) && !entry.name.startsWith('._.')) {
            const file = await readWebkitEntry(entry);
            setFileFullPath(reader, file);
            files.push(file);
          }
        } else if (entry.isDirectory) {
          entry.fullPath = reader.fullPath;
          try {
            files = files.concat(await getFilesFromDirectory(entry, true));
          } catch (e) {
            // Something isn't supported...
            formError.set(NOT_SUPPORTED_MSG);
          }
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
      formError.set(`please submit up to ${Meteor.settings.public.maxFilesQty} files. ${files.length} files were selected`);
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
    try {
      // ASK IF USER OKAY WITH WEB PUSH NOTIFICATIONS
      // GET subscription IF PERMISSION IS GRANTED
      await webPush.check();
    } catch (e) {
      // -- perhaps not fully enabled Push deamon like iOS
    }

    // ITEREATE OVER EACH SELECTED FILE BY USER.
    // AND UPLOAD EACH FILE INDIVIDUALLY.
    // INSIDE `.on('start')` EVENT WE GET {FileUpload}
    // INSTANCE AND PUSH IT TO `uploads` {ReactiveVar} ARRAY.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const upload = Collections.files.insert({
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
        formError.set(`${currentError}${this.file.name}: ${(_app.isObject(error) && error?.reason) ? error.reason : (error || 'unexpected error occurred')}`);
        this.errorTimer = setTimeout( () => {
          formError.set(false);
        }, 15000);
        cleanUploaded(this);
      }).on('start', function() {
        template.heatingUp.set(false);
        uploads.push(this);
        _app.uploads.set(uploads);
      });

      upload.start();
    }
    return true;
  };
});

Template.uploadForm.helpers({
  isOffline() {
    return !Meteor.status().connected;
  },
  meteorStatus() {
    return Meteor.status().status;
  },
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
  'click [data-reconnect]'(e) {
    e.preventDefault();
    Meteor.reconnect();
    return false;
  },
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
    let i = -1;
    let dirs = [];
    let files = [];
    const pushFile = (file) => {
      // FILTER ZERO-SIZE AND SYSTEM FILES
      if (file.size > 0 && !SYSTEM_HIDDEN_FILES.includes(file.name) && !file.name.startsWith('._.')) {
        setFileFullPath({}, file);
        files.push(file);
      }
    };

    for (const file of e.originalEvent.dataTransfer.files) {
      i++;
      const item = e.originalEvent.dataTransfer.items[i];
      // WHENEVER WE USE WEBKIT UNOFFICIAL API VIA .webkitGetAsEntry
      // OR MODERN WORKING DRAFT AND PARTIALLY DROPPED .getAsFileSystemHandle
      // TO READ A DIRECTORY — BOTH OF METHODS WOULD RETURN EMPTY RESPONCE INSIDE
      // ASYNC CALL OR AFTER USING await KEYWORD. THIS HAPPENS FOR SECURITY REASONS
      // AS FILESYSTEM HANDLE LIVES INSIDE SINGLE EVENT LOOP CYCLE
      if (typeof item.webkitGetAsEntry !== 'function' && typeof item.getAsFileSystemHandle !== 'function') {
        pushFile(file);
      } else {
        let fsFile;
        if (typeof item.webkitGetAsEntry === 'function') {
          fsFile = item.webkitGetAsEntry();
        } else if (typeof item.getAsFileSystemHandle === 'function') {
          fsFile = await item.getAsFileSystemHandle();
        }

        if (fsFile.isFile === true || fsFile.kind === 'file') {
          pushFile(file);
        } else {
          dirs.push(fsFile);
        }
      }
    }

    // IF DIRECTORIES ARE PASSED TO `drop` EVENT AND BROWSER HAS API TO
    // READ IT — PROCEED WITH RECURSIVELY READING DIRECTORIES
    if (dirs.length) {
      try {
        for (const dir of dirs) {
          files = files.concat(await getFilesFromDirectory(dir, dir.isDirectory));
        }
      } catch (readDirErr) {
        // Something isn't supported...
        Meteor._debug(NOT_SUPPORTED_MSG, readDirErr);
        formError.set(NOT_SUPPORTED_MSG);
        return false;
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
