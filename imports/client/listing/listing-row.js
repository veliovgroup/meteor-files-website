import { Template } from 'meteor/templating';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { _app, Collections } from '/imports/lib/core.js';
import './listing-row.sass';
import './listing-row.html';

Template.listingRow.helpers({
  isOwned() {
    return this.userId === Meteor.userId();
  }
});

Template.listingRow.events({
  'click [data-download-file]'(e) {
    e.stopPropagation();
  },
  'click [data-show-file]'(e) {
    e.preventDefault();
    FlowRouter.go('file', { _id: this._id });
    return false;
  },
  async 'click [data-hide]'(e) {
    e.preventDefault();

    if (Collections.files.allowClientCode) {
      // REMOVE FILE FROM SERVER
      // WORKS ONLY IF `{allowClientCode: true}`
      await Collections.files.removeAsync(this._id);
    }

    // THEN REMOVE THIS FILE FROM PERSISTENT STORAGE
    const recentUploads = _app.conf.recentUploads.get();
    if (recentUploads && recentUploads.length) {
      for (const fileRef of recentUploads) {
        if (fileRef._id === this._id) {
          recentUploads.splice(recentUploads.indexOf(fileRef), 1);
          _app.conf.recentUploads.set(recentUploads);
          break;
        }
      }
    }

    return false;
  },
  async 'click [data-remove]'(e) {
    e.preventDefault();
    await Meteor.callAsync('file.remove', this._id);
    return false;
  }
});
