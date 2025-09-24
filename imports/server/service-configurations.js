import { _app } from '/imports/lib/core.js';
import { ServiceConfiguration } from 'meteor/service-configuration';

_app.sc = {};
await ServiceConfiguration.configurations.removeAsync({});

if (Meteor.settings.serviceConfiguration?.['meteor-developer']) {
  _app.sc.meteor = true;
  await ServiceConfiguration.configurations.upsertAsync({
    service: 'meteor-developer'
  }, {
    $set: Meteor.settings.serviceConfiguration['meteor-developer']
  });
}

if (Meteor.settings.serviceConfiguration?.github) {
  _app.sc.github = true;
  await ServiceConfiguration.configurations.upsertAsync({
    service: 'github'
  }, {
    $set: Meteor.settings.serviceConfiguration.github
  });
}

if (Meteor.settings.serviceConfiguration?.twitter) {
  _app.sc.twitter = true;
  await ServiceConfiguration.configurations.upsertAsync({
    service: 'twitter'
  }, {
    $set: Meteor.settings.serviceConfiguration.twitter
  });
}

if (Meteor.settings.serviceConfiguration?.facebook) {
  _app.sc.facebook = true;
  await ServiceConfiguration.configurations.upsertAsync({
    service: 'facebook'
  }, {
    $set: Meteor.settings.serviceConfiguration.facebook
  });
}
