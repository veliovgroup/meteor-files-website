import { check } from 'meteor/check';
import { Meteor } from 'meteor/meteor';
import { Collections } from '/imports/lib/core.js';
import { webPush } from '/imports/server/web-push.js';

Meteor.methods({
  async 'file.unblame'(_id) {
    check(_id, String);

    await Collections.files.updateAsync({
      _id
    }, {
      $inc: {
        'meta.blamed': -1
      }
    });
    return true;
  },
  async 'file.blame'(_id) {
    check(_id, String);

    const fileCursor = await Collections.files.findOneAsync({ _id }, {
      fields: {
        'meta.blamed': 1
      }
    });

    if (!fileCursor) {
      return false;
    }

    if (fileCursor.meta.blamed >= 5) {
      await fileCursor.removeAsync();
      return true;
    }

    await Collections.files.updateAsync({
      _id
    }, {
      $inc: {
        'meta.blamed': 1
      }
    });
    return true;
  },
  async 'file.get'(_id) {
    // THIS IS EXAMPLE METHOD OF HOW
    // FILES CAN GET PULLED FROM SERVER VIA METHOD
    // THIS APP USES PUBLICATIONS/SUBSCRIPTIONS TO GET DETAILS OF INDIVIDUAL FILES
    check(_id, String);

    const fileCursor = await Collections.files.findOneAsync({ _id }, {
      fields: {
        _id: 1,
        name: 1,
        size: 1,
        type: 1,
        'meta.expireAt': 1,
        'meta.blamed': 1,
        isPDF: 1,
        isText: 1,
        isJSON: 1,
        isVideo: 1,
        isAudio: 1,
        isImage: 1,
        extension: 1,
        _collectionName: 1,
        _downloadRoute: 1
      }
    });

    if (fileCursor) {
      return fileCursor.get();
    }

    return void 0;
  },
  'webpush.test'(subscription) {
    check(subscription, String);

    webPush.send(subscription, {
      title: 'Test notification',
      body: 'If you can read this, it means web-push notifications are working!'
    });

    return true;
  }
});
