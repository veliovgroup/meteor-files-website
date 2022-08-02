import { _app } from '/imports/lib/core.js';
import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { FlowRouterMeta, FlowRouterTitle } from 'meteor/ostrio:flow-router-meta';

// inMemoryRendering ISN'T STABLE YET, BUT UNCOMMETING
// LINES BELOW WOULD ACTIVATE "OFF-SCREEN" TEMPLATE RENDERING
// FlowRouter.Renderer.inMemoryRendering = true;
// FlowRouter.Renderer.getMemoryElement = () => {
//   return document.createDocumentFragment();
// };

const title = 'Upload and share files';
const description = 'Upload and share files for free without registration';

FlowRouter.globals.push({ title });

FlowRouter.globals.push({
  meta: {
    robots: 'index, follow',
    keywords: {
      name: 'keywords',
      itemprop: 'keywords',
      content: 'file, files, fast, quick, upload, share, sharing, share file, upload file'
    },
    'og:url': {
      name: 'url',
      property: 'og:url',
      content() {
        return _app.currentUrl();
      }
    },
    'og:title': {
      name: 'title',
      property: 'og:title',
      content() {
        return document.title || title;
      }
    },
    description: {
      name: 'description',
      itemprop: 'description',
      property: 'og:description',
      content: description
    },
    'twitter:description': description,
    'twitter:title'() {
      return document.title || title;
    },
    'twitter:url'() {
      return _app.currentUrl();
    },
    'og:image': {
      name: 'image',
      property: 'og:image',
      content: Meteor.absoluteUrl('social-1280x640.png')
    },
    'twitter:image': {
      name: 'twitter:image',
      content: Meteor.absoluteUrl('social-1280x640.png')
    }
  },
  link: {
    canonical: {
      rel: 'canonical',
      itemprop: 'url',
      href() {
        return _app.currentUrl();
      }
    },
    image: {
      itemprop: 'image',
      content: Meteor.absoluteUrl('social-1280x640.png'),
      href: Meteor.absoluteUrl('social-1280x640.png')
    }
  }
});

new FlowRouterMeta(FlowRouter);
new FlowRouterTitle(FlowRouter);
