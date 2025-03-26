import { filesize } from 'meteor/mrt:filesize';
import { Template } from 'meteor/templating';
import './upload-row.html';
import './upload-row.sass';

Template.uploadRow.helpers({
  estimatedBitrate() {
    return `${filesize(this.estimateSpeed.get(), { bits: true })}/s`;
  },
  getProgressClass() {
    let progress = Math.ceil(this.progress.get() / 5) * 5;
    if (progress > 100) {
      progress = 100;
    }
    return progress;
  },
});

Template.uploadRow.events({
  'click [data-toggle-upload]'(e) {
    e.preventDefault();
    this.toggle();
    return false;
  },
  async 'click [data-abort-upload]'(e) {
    e.preventDefault();
    await this.abort();
    return false;
  }
});
