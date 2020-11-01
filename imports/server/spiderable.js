import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import Spiderable from 'meteor/ostrio:spiderable-middleware';

if (Meteor.settings.spiderable?.auth) {
  WebApp.connectHandlers.use(new Spiderable({
    rootURL: process.env.ROOT_URL,
    serviceURL: 'https://render.ostr.io',
    auth: Meteor.settings.spiderable.auth,
    only: [/^\/?$/, /^\/about\/?$/i, /^\/f\/[A-z0-9]{16}\/?$/i]
  }));
}
