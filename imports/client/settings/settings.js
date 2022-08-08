import { _app } from '/imports/lib/core.js';
import { Template } from 'meteor/templating';

import './settings.sass';
import './settings.jade';

Template.settings.onRendered(function() {
  window.IS_RENDERED = true;
});

Template.settings.helpers({
  uploadTransport() {
    return _app.conf.uploadTransport.get();
  },
  isNewVersionAvailable() {
    return _app.isNewVersionAvailable.get();
  }
});

Template.settings.events({
  'click input[type="radio"]'(e) {
    _app.conf.uploadTransport.set(e.currentTarget.value);
    return true;
  },
  'click [data-trigger-hcp]'(e) {
    e.preventDefault();
    _app.isNewVersionAvailable.set(true);
    return false;
  }
});
