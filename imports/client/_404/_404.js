import { Template } from 'meteor/templating';

import '/imports/client/file/file.sass';
import './_404.jade';

Template._404.onRendered(function() {
  window.IS_RENDERED = true;
});
