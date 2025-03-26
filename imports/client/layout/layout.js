import { Random } from 'meteor/random';
import { Template } from 'meteor/templating';

import { _app } from '/imports/lib/core.js';
import { onReload } from '/imports/client/misc/on-reload.js';

import '/imports/client/upload/upload-form.js';
import './layout.sass';
import './layout.html';

const copySuccess = (elementId, template) => {
  const element = template.find(`#${elementId}`);
  if (element && !element.className.includes(' copy-success')) {
    element.className += ' copy-success';
  }
};

const copyRestore = (elementId, template) => {
  const element = template.find(`#${elementId}`);
  if (element && element.className.includes(' copy-success')) {
    element.className = element.className.replace(' copy-success', '');
  }
};

Template.layout.helpers({
  isNewVersionAvailable() {
    return _app.isNewVersionAvailable.get();
  },
  corner() {
    // TEST "REGIONS" SUPPORT BY FLOW-ROUTER-EXTRA
    return 'gh-ribbon';
  },
});

Template.layout.events({
  'click [data-hcp-refresh]'(e) {
    e.preventDefault();
    onReload();
    return false;
  },
  'click [data-hcp-dismiss]'(e) {
    e.preventDefault();
    _app.isNewVersionAvailable.set(false);
    return false;
  },
  'click [data-copy]'(e, template) {
    e.preventDefault();
    e.stopPropagation();
    const text = (e.currentTarget.dataset.copy || '').trim();
    let elementId = e.currentTarget.id;
    if (!elementId) {
      elementId = Random.id();
      e.currentTarget.id = elementId;
    }

    if (text) {
      if ('clipboard' in navigator) {
        navigator.clipboard.writeText(text);
      } else {
        const element = document.createElement('textarea');
        element.className = 'absolute-invisible';
        element.value = text;
        document.body.appendChild(element);

        if (navigator.userAgent.match(/ipad|iphone/i)) {
          const range = document.createRange();
          range.selectNodeContents(element);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          element.setSelectionRange(0, text.length + 1);
        } else {
          element.select();
        }

        document.execCommand('copy');
        element.remove();
      }

      copySuccess(elementId, template);
      setTimeout(() => {
        copyRestore(elementId, template);
      }, 4000);
    }
    return false;
  }
});
