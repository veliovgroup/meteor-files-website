[![support](https://img.shields.io/badge/support-GitHub-white)](https://github.com/sponsors/dr-dimitru)
[![support](https://img.shields.io/badge/support-PayPal-white)](https://paypal.me/veliovgroup)
<a href="https://ostr.io/info/built-by-developers-for-developers?ref=meteor-files-website-repo-top"><img src="https://ostr.io/apple-touch-icon-60x60.png" height="20"></a>
<a href="https://meteor-files.com/?ref=meteor-files-website-repo-top"><img src="https://meteor-files.com/apple-touch-icon-60x60.png" height="20"></a>

# File sharing web app

This is repository with codebase of the web application available at [files.veliov.com](https://files.veliov.com/). It's fully-featured file-sharing service build on top of [`ostrio:files` library](https://github.com/veliovgroup/Meteor-Files) and [meteor.js](https://docs.meteor.com).

This is third reincarnation of this webapp, most of changes in this release made during [Impact Meteor Conference 2020](https://impact.meteor.com) to showcase Meteor usage building modern webapps.

Awarded by Meteor Chef with [GCAA 2016](https://themeteorchef.com/blog/giant-cotton-apron-awards-show). Used by [thousands Meteor developers](https://atmospherejs.com/ostrio/files) to manage files and uploads in Meteor.js apps.

Backed by [veliovgroup](https://veliovgroup.com), sponsored by [ostr.io](https://ostr.io), [meteor-files.com](https://meteor-files.com/), and [awesome community members](https://github.com/veliovgroup/Meteor-Files#supporters). Idea, design, development, maintenance, and support by [@smart_egg](https://twitter.com/smart_egg) and [@veliovgroup](https://twitter.com/veliovgroup).

## ToC:

- [Links](https://github.com/veliovgroup/meteor-files-website#links)
- [Goals](https://github.com/veliovgroup/meteor-files-website#goals) of this project
- [Features](https://github.com/veliovgroup/meteor-files-website#functionality)
- [Quick start](https://github.com/veliovgroup/meteor-files-website#quick-start)
  - [Activate AWS:S3](https://github.com/veliovgroup/meteor-files-website#activate-awss3)
  - [Activate Web Push Notifications](https://github.com/veliovgroup/meteor-files-website#activate-web-push-notifications)
  - [Change application settings](https://github.com/veliovgroup/meteor-files-website#application-settings)
- [Deploy this app](https://github.com/veliovgroup/meteor-files-website#deployment)
- [SEO](https://github.com/veliovgroup/meteor-files-website#seo)
  - [`title` and `meta` tags](https://github.com/veliovgroup/meteor-files-website#meta-tags-and-title)
  - [Pre-rendering](https://github.com/veliovgroup/meteor-files-website#pre-rendering)
- [Debugging](https://github.com/veliovgroup/meteor-files-website#debugging)
- ❤️ [Support this project](https://github.com/veliovgroup/meteor-files-website#support-this-project)

## Links:

- Website: __[files.veliov.com](https://files.veliov.com/)__
- Meteor's [tutorials repository](https://github.com/veliovgroup/meteor-snippets#meteor-snippets) inspired by this app
- [`ostrio:files`](https://github.com/veliovgroup/Meteor-Files) library
- Self-hosted (Nginx + Phusion Passenger) [deploy tutorial](https://github.com/veliovgroup/meteor-snippets/tree/main/devops#deploy)
- Hekoru [deploy instructions](https://github.com/veliovgroup/meteor-files-website/blob/master/heroku-deploy.md)

## Goals

Goals of this open source web application:

- Showcase usage of [`ostrio:files` library](https://github.com/veliovgroup/Meteor-Files)
- Showcase usage of ServiceWorker with Meteor
- Showcase implementing fully-featured PWA (*including push-notifications*) using Meteor
- Build good and open source solution to quickly upload and share files

## Functionality:

- 📑 Upload / Download Files
- 🗂 Drag'n'drop support for files and directories (*including nested directories*)
- 🗄 Use AWS:S3 as a storage
- 📲 PWA with Push Notifications
- 🚀 Upload via `HTTP` and/or `DDP`

## Quick start:

Application is ready to be used as it is without need of extra configuration. Optionally there's a lot of room for changing settings to meet required features, like store files in AWS:S3, send Web Push Notifications via APNs when file is fully loaded and moved to long-term storage.

- [Activate AWS:S3](https://github.com/veliovgroup/meteor-files-website#activate-awss3)
- [Activate Web Push Notifications](https://github.com/veliovgroup/meteor-files-website#activate-web-push-notifications)
- [Change application settings](https://github.com/veliovgroup/meteor-files-website#application-settings)

### Activate AWS:S3

1. Read [this article](https://github.com/veliovgroup/Meteor-Files/wiki/AWS-S3-Integration)
2. After creating S3 bucket, create CloudFront Distribution and attach it to S3 bucket
3. Set S3 credentials into `METEOR_SETTINGS` env.var or pass as the file, read [here for more info](http://docs.meteor.com/#/full/meteor_settings), alternatively (*if something not working*) set `S3` env.var
4. You can pass S3 credentials as JSON-string when using "*Heroku's one click install-button*"

S3 credentials format (*region is required*):

```js
{
  "s3": {
    "key": "xxx",
    "secret": "xxx",
    "bucket": "xxx",
    "region": "xxx"
  }
}
```

### Activate Web Push Notifications

1. Install [`web-push` NPM](https://www.npmjs.com/package/web-push) package
2. Generate key-pair using `webpush.generateVAPIDKeys()`;
3. Set VAPID credentials into `METEOR_SETTINGS` env.var or pass as the file, read [here for more info](http://docs.meteor.com/#/full/meteor_settings)

VAPID credentials format:

```js
{
  "public": {
    "vapid": {
      "publicKey": ""
    }
  },
  "vapid": {
    "email": "mailto:webmaster@example.com", // SET TO REAL EMAIL
    "privateKey": ""
  }
}
```

### Application settings

All supported and annotated settings

```js
{
  "debug": false, // Enable debug mode on a Server
  "storagePath": "/data/meteor-files/uploads", // LOCAL STORAGE ON THE SERVER
  "spiderable": { // `spiderable-middleware` package settings
    "auth": ""
  },
  "public": {
    "debug": false, // Enable debug mode on a Client (Browser)
    "maxFileSizeMb": 1024, // MAXIMUM UPLOAD FILE-SIZE IN MEGABYTES (1024mb ~= 1GB)
    "maxFilesQty": 8, // MAXIMUM AMOUNT OF SIMULTANEOUSLY UPLOADED FILES
    "fileTTLSec": 259200, // 3 days; FILE'S TTL IN SECONDS
    "vapid": { // VAPID WEB PUSH NOTIFICATIONS CONFIGURATION
      "publicKey": "" // WEB PUSH NOTIFICATION PUBLIC KEY
    },
    "trackingId": "" // trackingId for ostrio-analytics package
  },
  "s3": { // AWS:S#3 CLOUD STORAGE CREDENTIALS
    "key": "",
    "secret": "",
    "bucket": "",
    "region": ""
  },
  "vapid": { // VAPID WEB PUSH NOTIFICATIONS CONFIGURATION
    "email": "mailto:webmaster@example.com", // WEB PUSH NOTIFICATION EMAIL
    "privateKey": "" // WEB PUSH NOTIFICATION PRIVATE KEY
  }
}
```

## Deployment

Learn more about DevOps, deployment, and running this app live in [DevOps and Deployment tutorial](https://github.com/veliovgroup/meteor-snippets/tree/main/devops).

## SEO

To make this project "crawlable" by search engines, social networks, and web-crawlers on this project we are using:

- [`ostrio:flow-router-meta`](https://github.com/veliovgroup/Meteor-flow-router-meta) package to generate meta-tags and title
- [Pre-rendering](https://prerendering.com/) service to serve rendered HTML to crawlers and search engines

### Meta tags and title

Using [`ostrio:flow-router-meta`](https://github.com/veliovgroup/Meteor-flow-router-meta) package controlling meta-tags content as easy as extending *FlowRouter* definition with `{ meta, title, link }` properties:

```js
FlowRouter.route('/about', {
  name: 'about',
  title: 'About',
  meta: {
    description: 'About file-sharing web application'
  },
  action() {
    this.render('layout', 'about');
  }
});
```

Set default meta tags and page title using `FlowRouter.globals.push({ meta })`:

```js
const title = 'Default page title up to 65 symbols';
const description = 'Default description up to 160 symbols';

FlowRouter.globals.push({ title });
FlowRouter.globals.push({
  meta: {
    description,
    robots: 'index, follow',
    keywords: 'keywords, separated, with, comma'
  }
});
```

Activate `meta` and `title` packages:

```js
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { FlowRouterMeta, FlowRouterTitle } from 'meteor/ostrio:flow-router-meta';

/* ... DEFINE FLOWROUTER RULES HERE, BEFORE INIT ... */

new FlowRouterTitle(FlowRouter);
new FlowRouterMeta(FlowRouter);
```

### Pre-rendering

To pre-render JS-driven templates (Blaze, React, Vue, etc.) to HTML we are using [pre-rendering](https://prerendering.com/) via [`siderable-middleware` package](https://github.com/veliovgroup/spiderable-middleware#meteor-specific-usage):

```js
/*
 * @locus Server
 */

import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import Spiderable from 'meteor/ostrio:spiderable-middleware';

WebApp.connectHandlers.use(new Spiderable({
  serviceURL: 'https://render.ostr.io',
  auth: 'pass:login',
  only: [/^\/?$/, /^\/about\/?$/i, /^\/f\/[A-z0-9]{16}\/?$/i]
}));

// Allow pre-rendering only for existing public routes: `/index`, `/about`, and `/f/file_id`
```

Pre-rendering getting activated by setting `spiderable.auth` property in `METEOR_SETTINGS` environment variable or [`settings.json`](https://github.com/veliovgroup/meteor-files-website/blob/master/settings.json) on a dev stage.

## Debugging

Having an issue running this web application? Try next options to find out why:

### On a server

Set environment variable `DEBUG` to `true` or `{ debug: true }` in the [settings file](https://docs.meteor.com/api/core.html#Meteor-settings) passed via `--settings` option. This will enable logging mode in the meteor-files package

### On a client (browser)

Set `{ public: { debug: true } }` in the [settings file](https://docs.meteor.com/api/core.html#Meteor-settings) passed via `--settings` option. This will enable logging mode in the meteor-files package and other components of the web application

## Support our open source contributions

- Upload and share files using [☄️ meteor-files.com](https://meteor-files.com/?ref=meteor-files-website-repo-footer) — Continue interrupted file uploads without losing any progress. There is nothing that will stop Meteor from delivering your file to the desired destination
- Use [▲ ostr.io](https://ostr.io?ref=meteor-files-website-repo-footer) for [Server Monitoring](https://snmp-monitoring.com), [Web Analytics](https://ostr.io/info/web-analytics?ref=meteor-files-website-repo-footer), [WebSec](https://domain-protection.info), [Web-CRON](https://web-cron.info) and [SEO Pre-rendering](https://prerendering.com) of a website
- [Sponsor via GitHub](https://github.com/sponsors/dr-dimitru)
- [Support via PayPal](https://paypal.me/veliovgroup)
- Star this project on [GitHub](https://github.com/veliovgroup/Meteor-Files)
- Star this project on [Atmosphere](https://atmospherejs.com/ostrio/files)
