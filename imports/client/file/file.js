import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { _app } from '/imports/lib/core.js';
import './file.sass';
import './file.html';

Template.file.onRendered(function() {
  window.IS_RENDERED = true;

  // ADD OPENED FILE TO CACHED recentUploads PERSISTENT ReactiveVar
  // TO DISPLAY IT LATER IN THE LIST OF THE FILES AT THE MAIN PAGE
  const recentUploads = _app.conf.recentUploads.get();
  if (recentUploads && this.data.file?._id) {
    let isNew = true;
    if (recentUploads.length) {
      for (const file of recentUploads) {
        if (file._id === this.data.file._id) {
          isNew = false;
          break;
        }
      }
    }

    if (isNew) {
      recentUploads.push(this.data.file.get());
      _app.conf.recentUploads.set(recentUploads);
    }
  }
});

Template.file.helpers({
  isBlamed() {
    return _app.conf.blamed.get().includes(this._id);
  },
  canPreview() {
    return this.isPDF || this.isAudio || this.isVideo || this.isImage || false;
  }
});

Template.file.events({
  'click [data-show-file]'(e, template) {
    e.preventDefault();
    const container = template.$('.file-body.scroll-wrap');
    if (container) {
      container.animate({ scrollTop: 0 }, 256);
    }
    return false;
  },
  'click [data-show-info]'(e, template) {
    e.preventDefault();
    const container = template.$('.file-body.scroll-wrap');
    if (container && container[0]) {
      container.animate({ scrollTop: container[0].scrollHeight }, 256);
    }
    return false;
  },
  async 'click [data-blame]'(e, template) {
    e.preventDefault();
    const blamed = _app.conf.blamed.get();
    if (blamed.includes(this._id)) {
      blamed.splice(blamed.indexOf(this._id), 1);
      _app.conf.blamed.set(blamed);
      await Meteor.callAsync('file.unblame', this._id);
    } else {
      blamed.push(this._id);
      _app.conf.blamed.set(blamed);

      if (template.data.file.meta.blamed >= 5) {
        FlowRouter.go('/');
      }

      await Meteor.callAsync('file.blame', this._id);
    }
    return false;
  }
});
