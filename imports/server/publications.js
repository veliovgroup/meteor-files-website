import { check } from 'meteor/check';
import { Meteor } from 'meteor/meteor';
import { Collections } from '/imports/lib/core.js';

Meteor.publish('file.list', function (_ids) {
  check(_ids, [String]);

  let selector = {
    _id: {
      $in: _ids
    }
  };

  if (this.userId) {
    selector = {
      $or: [selector, {
        userId: this.userId
      }]
    };
  }

  return Collections.files.collection.find(selector, {
    sort: {
      'meta.createdAt': -1
    },
    fields: {
      _id: 1,
      name: 1,
      size: 1,
      userId: 1,
      'meta.expireAt': 1,
      'meta.createdAt': 1,
      isPDF: 1,
      isText: 1,
      isJSON: 1,
      isVideo: 1,
      isAudio: 1,
      isImage: 1,
      _collectionName: 1,
      _downloadRoute: 1,
    }
  });
});

Meteor.publish('file.get', function (_id) {
  check(_id, String);
  return Collections.files.collection.find({
    _id
  }, {
    fields: {
      _id: 1,
      name: 1,
      size: 1,
      type: 1,
      userId: 1,
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
      _downloadRoute: 1,
    }
  });
});
