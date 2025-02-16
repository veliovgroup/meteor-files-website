import { Meteor } from 'meteor/meteor';
import webpush from 'web-push';

/**
 * @constant
 * @name DEFAULT_MESSAGE
 * @summary OBJECT WITH MOST USED AND REQUIRED FIELDS OF WEB-PUSH NOTIFICATION
 */
const DEFAULT_MESSAGE = {
  data: {
    url: '/',
  },
  actions: [{
    action: 'view',
    title: 'View'
  }, {
    action: 'dismiss',
    title: 'Dismiss'
  }],
  title: 'Notification title',
  body: 'This is notification body',
  icon: '/android-chrome-256x256.png',
  badge: '/android-chrome-96x96.png',
  vibrate: [100, 50, 150, 50, 200],
  lang: 'en-US',
  dir: 'auto',
  tag: 'test'
};

// SEE `settings.json` AND `README.md` for more details
// GENERATE KEY PAIR USING `webpush.generateVAPIDKeys()` ONCE AND UPDATE SETTINGS IN `settings.json`
const vapid = Meteor.settings.app.vapid || false;
if (vapid && vapid.email && vapid.privateKey && Meteor.settings.public.vapid?.publicKey) {
  webpush.setVapidDetails(vapid.email, Meteor.settings.public.vapid?.publicKey || vapid.publicKey, vapid.privateKey);
}

const webPush = {
  /**
   * Send push notification with message
   *
   * @method
   * @namespace webPush
   * @name send
   * @param {string} subscription - Object as a string, from ServiceWorkerRegistration#pushManager.getSubscription()
   * @param {Object} messageObj - Message body as plain-object
   * @returns {void 0}
   */
  send(subscription, messageObj) {
    if (vapid) {
      webpush.sendNotification(JSON.parse(subscription), JSON.stringify(Object.assign({}, DEFAULT_MESSAGE, messageObj))).then(() => {
        // WE ARE GOOD HERE, NOTIFICATION SUCCESSFULLY SENT 🎉
      }).catch((/*error*/) => {
        // ERROR MIGHT BE THROWN AND VERY COMMON DUE TO EXPIRED TOKENS AND UNSUBSCRIBED SESSIONS
        // IN OUR CASE WE WOULD JUST IGNORE SUCH ERROR
        //
        // IN MORE COMPLEX APP IF `subscription` OBJECT IS STORED IN DATABASE
        // SUBSCRIPTION OBJECT SHOULD BE REMOVED/INVALIDATED HERE
        // console.error('[webPush.send] Error:', error);
      });
    }
  }
};

export { webPush };
