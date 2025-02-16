import { Meteor } from 'meteor/meteor';
import { _app } from '/imports/lib/core.js';
import { Template } from 'meteor/templating';
import { webPush } from '/imports/client/misc/web-push.js';
import { ReactiveVar } from 'meteor/reactive-var';

import './settings.sass';
import './settings.html';

const PWA_INSTALL_ERROR = 'We\'re sorry, PWA can\'t be installed now 😕. PWA standard is very young and implemented differently from browser to browser, we\'re working hard 👨‍💻 to add PWA support to all platforms.';

Template.settings.onCreated(function () {
  this.data.hasWebPushSupport = webPush.isSupported;
  this.pushTestStatus = new ReactiveVar(false);
});

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
  },
  pushTestStatus() {
    return Template.instance().pushTestStatus.get();
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
      installPrompt.prompt();
      installPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome !== 'accepted') {
          alert(PWA_INSTALL_ERROR);
        }
      }).catch((error) => {
        console.error('[data-install-pwa] [installPrompt.userChoice.catch()] ERROR:', error);
        alert(PWA_INSTALL_ERROR);
      });
    } catch (err) {
      console.error('[data-install-pwa] [installPrompt.prompt()] ERROR:', err);
    }
    Meteor.pwaInstallPrompt.set(false);
    return false;
  },
  async 'click [data-web-push]'(e, template) {
    e.preventDefault();
    template.pushTestStatus.set('1');
    try {
      await webPush.check();
    } catch (_e) {
      // user declined notifications permissions request, we are good here
    }

    if (webPush.subscription) {
      Meteor.call('webpush.test', webPush.subscription, (error, res) => {
        if (!error && res === true) {
          template.pushTestStatus.set(true);
        } else {
          template.pushTestStatus.set(false);
        }
      });
    } else {
      template.pushTestStatus.set(true);
      alert('We are sorry, but you declined Notification permission request.');
    }
    return false;
  }
});
