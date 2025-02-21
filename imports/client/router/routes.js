import { Meteor } from 'meteor/meteor';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { _app, Collections } from '/imports/lib/core.js';

const meta404 = {
  robots: 'noindex, nofollow',
  title: '404: Page not found',
  keywords: {
    name: 'keywords',
    itemprop: 'keywords',
    content: '404, page, not found'
  },
  description: {
    name: 'description',
    itemprop: 'description',
    property: 'og:description',
    content: '404: No such page'
  },
  'twitter:description': '404: No such page',
  'og:image': {
    property: 'og:image',
    content: Meteor.absoluteUrl('social-1280x640.png')
  },
  'twitter:image': {
    name: 'twitter:image',
    content: Meteor.absoluteUrl('social-1280x640.png')
  }
};

// ASK FLOWROUTER TO WAIT AND PULL ALL DYNAMIC DEPENDENCIES
// BEFORE INITIALIZING ROUTER
FlowRouter.wait();
Promise.all([
  import('/imports/client/loading/loading.html'),
  import('/imports/client/styles/core.sass'),
  import('/imports/client/line-awesome.css'),
  import('/imports/client/layout/layout.js')
]).then(() => {
  FlowRouter.initialize();
}).catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[Promise.all] loading dynamic imports error:', e);
});

// WRAPPER FOR whileWaiting METHOD
// TO REMOVE BLINKING "SPINNER" BETWEEN ROUTES
// THIS FUNCTION WOULD DELAY "loading" TEMPLATE RENDER BY 1024 MS
let lastRun;
let renderWaitingTimer;
let renderActionTimer;
const renderDelay = 256;
const cancelAfterNext = () => {
  clearTimeout(renderWaitingTimer);
  clearTimeout(renderActionTimer);
};
const renderWaiting = (router, layoutName, templateName) => {
  cancelAfterNext();
  lastRun = Date.now();
  router.render(layoutName, templateName);
};
const renderAction = (router, ...args) => {
  cancelAfterNext();
  const tdiff = Date.now() - lastRun;
  if (!lastRun || tdiff > renderDelay) {
    router.render(...args);
  } else if (tdiff) {
    renderActionTimer = setTimeout(() => {
      router.render(...args);
    }, tdiff);
  }
};

FlowRouter.route('/', {
  name: 'index',
  action() {
    renderAction(this, 'layout', 'index');
  },
  waitOn(_params, _queryParams, ready) {
    return [import('/imports/client/index/index.js'), Tracker.autorun(() => {
      // REACTIVE DATA WARAPPED INTO TRACKER
      // WILL RE-RUN SUBSCRIPTION WITH NEW ARGUMENTS
      const uploadIds = _app.conf.recentUploads.get().map((file) => file._id).filter((_id) => typeof _id === 'string');
      ready(() => {
        return Meteor.subscribe('file.list', uploadIds);
      });
    })];
  },
  whileWaiting() {
    renderWaiting(this, 'layout', 'loading');
  }
});

FlowRouter.route('/about', {
  name: 'about',
  title: 'About',
  meta: {
    keywords: {
      name: 'keywords',
      itemprop: 'keywords',
      content: 'about, file, files, share, sharing, upload, service, free, details'
    },
    description: {
      name: 'description',
      itemprop: 'description',
      property: 'og:description',
      content: 'About file-sharing web application'
    },
    'twitter:description': 'About file-sharing web application'
  },
  action() {
    renderAction(this, 'layout', 'about');
  },
  waitOn() {
    return import('/imports/client/about/about.js');
  },
  whileWaiting() {
    renderWaiting(this, 'layout', 'loading');
  }
});

FlowRouter.route('/settings', {
  name: 'settings',
  title: 'Settings',
  meta: {
    robots: 'noindex, nofollow',
    keywords: {
      name: 'keywords',
      itemprop: 'keywords',
      content: 'settings, options, configuration, file, upload, share, sharing'
    },
    description: {
      name: 'description',
      itemprop: 'description',
      property: 'og:description',
      content: 'File upload and sharing settings'
    },
    'twitter:description': 'File upload and sharing settings'
  },
  action() {
    renderAction(this, 'layout', 'settings');
  },
  waitOn() {
    return import('/imports/client/settings/settings.js');
  },
  whileWaiting() {
    renderWaiting(this, 'layout', 'loading');
  }
});

FlowRouter.route('/f/:_id', {
  name: 'file',
  title(_params, _queryParams, file) {
    if (file) {
      return `Download shared file: ${(file.name || '').substring(0, 120)}`;
    }
    return meta404.title;
  },
  meta(_params, _queryParams, file) {
    if (file) {
      return {
        robots: 'noindex, nofollow',
        keywords: {
          name: 'keywords',
          itemprop: 'keywords',
          content: 'secure, file, download, shared, share'
        },
        description: {
          name: 'description',
          itemprop: 'description',
          property: 'og:description',
          content: 'Download shared file before its expiration'
        },
        'og:image': {
          property: 'og:image',
          content: Meteor.absoluteUrl('file-1280x640.png')
        },
        'twitter:description': 'Download shared file',
        'twitter:image': {
          name: 'twitter:image',
          content: Meteor.absoluteUrl('file-1280x640.png')
        }
      };
    }

    return meta404;
  },
  link: {
    image: {
      itemprop: 'image',
      content: Meteor.absoluteUrl('file-1280x640.png'),
      href: Meteor.absoluteUrl('file-1280x640.png')
    }
  },
  action(params, _queryParams, file) {
    renderAction(this, 'layout', 'file', { params, file });
  },
  waitOn(params) {
    return [import('/imports/client/file/file.js'), Meteor.subscribe('file.get', params._id)];
  },
  whileWaiting() {
    renderWaiting(this, 'layout', 'loading');
  },
  async onNoData() {
    // PULL 404 TEMPLATE AND ITS CONTROLLER "PROGRESSIVELY" FROM SERVER
    await import('/imports/client/_404/_404.js');
    // RENDER 404 TEMPLATE AFTER IT'S FULLY LOADED ON THE CLIENT
    this.render('layout', '_404');
  },
  async data(params) {
    return await Collections.files.findOneAsync(params._id);
  }
});

// 404 route (catch all)
FlowRouter.route('*', {
  title: '404: Page not found',
  meta: meta404,
  action() {
    renderAction(this, 'layout', '_404');
  },
  waitOn() {
    return import('/imports/client/_404/_404.js');
  },
  whileWaiting() {
    renderWaiting(this, 'layout', 'loading');
  }
});
