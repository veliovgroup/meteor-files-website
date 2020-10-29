import { Template } from 'meteor/templating';

import './_404.jade';

Template._404.onRendered(function() {
  window.IS_RENDERED = true;
});
