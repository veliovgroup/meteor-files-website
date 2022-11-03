import { Meteor } from 'meteor/meteor';
import { _app } from '/imports/lib/core.js';
import { Template } from 'meteor/templating';
import { webPush } from '/imports/client/misc/web-push.js';

import './settings.sass';
import './settings.jade';

const PWA_INSTALL_ERROR = 'We\'re sorry, PWA can\'t be installed now 😕. PWA standard is very young and implemented differently from browser to browser, we\'re working hard 👨‍💻 to add PWA support to all platforms.';

Template.settings.onRendered(function() {
  window.IS_RENDERED = true;
});

Template.settings.helpers({
  uploadTransport() {
    return _app.conf.uploadTransport.get();
  },
  isNewVersionAvailable() {
    return _app.isNewVersionAvailable.get();
  },
  hasPWASupport() {
    return Meteor.hasPWASupport && !!Meteor.pwaInstallPrompt.get();
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
  },
  'click [data-install-pwa]'(e) {
    e.preventDefault();
    try {
      const installPrompt = Meteor.pwaInstallPrompt.get();
      if (!installPrompt) {
        alert(PWA_INSTALL_ERROR);
        return false;
      }
      Meteor.pwaInstallPrompt.prompt();
      Meteor.pwaInstallPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome !== 'accepted') {
          alert(PWA_INSTALL_ERROR);
        }
      }).catch((error) => {
        console.error('[data-install-pwa] [Meteor.pwaInstallPrompt.userChoice.catch()] ERROR:', error);
        alert(PWA_INSTALL_ERROR);
      });
    } catch (err) {
      console.error('[data-install-pwa] [Meteor.pwaInstallPrompt.prompt()] ERROR:', err);
    }
    Meteor.pwaInstallPrompt.set(false);
    return false;
  }
});
