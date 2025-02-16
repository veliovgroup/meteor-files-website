import { Template } from 'meteor/templating';
import './about.html';
import './about.sass';

Template.about.onRendered(function() {
  window.IS_RENDERED = true;
});

Template.about.helpers({
  date() {
    return new Date().getFullYear();
  },
});
