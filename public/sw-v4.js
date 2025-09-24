/*
 * @locus public
 */

;(function (self) {
  'use strict';
  /**
   * @constant
   * @name CACHE_NAME
   * @type {string}
   * @summary UNIQUE CACHE KEY, `v*` SHOULD GET INCREMETED WITH ANY CHANGES TO THIS FILE
   */
  const CACHE_NAME = 'cacheKey_v4';

  /**
   * @constant
   * @name PRECACHE
   * @type {string[]}
   * @summary ARRAY OF STRINGS WITH ROUTES AND STATIC FILES TO PRE-CACHE UPON SERVICE WORKER INITIALIZATION
   */
  const PRECACHE = ['/', '/manifest.webmanifest', '/dnd.png', '/android-chrome-36x36.png', '/android-chrome-48x48.png', '/android-chrome-72x72.png', '/android-chrome-96x96.png', '/android-chrome-144x144.png', '/android-chrome-192x192.png', '/android-chrome-256x256.png', '/android-chrome-384x384.png', '/android-chrome-512x512.png', '/fonts/line-awesome.woff2', '/fonts/lato-v14-latin_latin-ext-700.woff2', '/fonts/lato-v14-latin_latin-ext-regular.woff2', '/fonts/lato-v14-latin_latin-ext-300.woff2'];

  /**
   * @constant
   * @name EVERGREEN
   * @type {string[]}
   * @summary ARRAY OF STRINGS WITH ROUTES AND STATIC FILES THAT CAN BE CACHED BUT SHOULD BE UPDATED UPON EVERY REQUEST
   */
  const EVERGREEN = ['/manifest.webmanifest'];

  /**
   * @constant
   * @name PASSTHROUGH
   * @type {string[]}
   * @summary ARRAY OF STRINGS WITH ROUTES AND STATIC FILES THAT NEVER CACHED
   */
  const PASSTHROUGH = ['/sockjs/', '/sw-', '/cdn/storage', '/__meteor__/'];

  /**
   * @constant
   * @name STATIC
   * @type {string[]}
   * @summary ARRAY OF STRINGS WITH STATIC FILE EXTENSIONS
   */
  const STATIC = ['.png', '.jpg', '.jpeg', '.ico', '.css', '.js', '.gif', '.webm', '.webp', '.eot', '.svg', '.ttf', '.webmanifest', '.woff', '.woff2'];

  // STORE self.location.origin IN SHORT VARIABLE
  const origin = self.location.origin;

  /**
   * @constant
   * @name DEFAULT_NOTIFICATION
   * @type {object}
   * @summary DEFAULT NOTIFICATION OBJECT
   */
  const DEFAULT_NOTIFICATION = {
    title: 'Notification received',
    body: 'Tap to view',
    data: {
      url: '/',
    },
    actions: [{
      action: 'view',
      title: 'View'
    }, {
      action: 'dismiss',
      title: 'Dismiss'
    }],
    icon: '/android-chrome-256x256.png',
    badge: '/android-chrome-96x96.png',
    lang: 'en-US',
    dir: 'auto',
  };


  /**
   * @constant
   * @name DEFAULT_RESPONSES
   * @type {object}
   * @summary DEFAULT RESPONSES FOR OFFLINE MODE
   */
  const DEFAULT_RESPONSES = {
    image: new Response('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>', {
      status: 200,
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
    }),
    style: new Response('', {
      status: 200,
      headers: { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-store' },
    }),
    script: new Response('', {
      status: 504,
      statusText: 'Gateway Timeout',
      headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' },
    }),
    fetch: new Response(JSON.stringify({ error: { offline: true }}), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    }),
    generic: new Response('', {
      status: 504,
      statusText: 'Gateway Timeout',
      headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' },
    }),
  };

  // LOGGING FACILITY
  const logMessage = (...args) => {
    console.log('[SW]', ...args);
  };

  const offlineAssetFallback = (req) => {
    const defaultResponse = DEFAULT_RESPONSES[req.destination];
    if (defaultResponse) {
      return defaultResponse.clone();
    }

    if ((req.headers.get('Accept') || '').includes('application/json')) {
      return DEFAULT_RESPONSES.fetch.clone();
    }

    return DEFAULT_RESPONSES.generic.clone();
  };

  const offlineResponse = new Response('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · files.veliov.com</title></head><body><h1>Service Unavailable</h1><p>You are offline, or service is temporarily unavailable. Please, try to <a href="#" onClick="window.location.href=window.location.href">reload the page</a>.</p><p>If you still see this page, that may mean you need to purge browser cache. One of the options is using DevTools. Please, follow the next path:<ol><li>To open DevTools: (right-click) -> "inspect element"</li><li>Click on the "Application" tab</li><li>Click on [clear site data] button</li></ol></p><p>Options to clear browser cache may vary from browser to browser. Still, it should be relatively easy to locate the "clear cache" option in the browser\'s settings.</p><p>We are very sorry for the inconvenience that may have caused you.</p></body></html>', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: new Headers({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    })
  });

  const exceptionHandler = (req, error, isStatic) => {
    logMessage('[exceptionHandler] Network Error:', error);
    if (isStatic) {
      return offlineAssetFallback(req);
    }

    return offlineResponse.clone();
  };

  const cacheOrException = async (req, error, isStatic) => {
    if (req.mode === 'navigate') {
      let cached = null;
      try {
        const cache = await caches.open(CACHE_NAME);
        cached = await cache.match('/', { ignoreSearch: true });
      } catch (cacheError) {
        logMessage('[cacheOrException] cacheError:', req.url, cacheError);
      }

      return cached || exceptionHandler(req, error, isStatic);
    }
    return exceptionHandler(req, error, isStatic);
  };

  const shouldRevalidate = (req, url) => {
    if (req.mode === 'navigate' || req.mode === 'cors') {
      return true;
    }

    for (const path of EVERGREEN) {
      if (url.pathname.startsWith(path)) {
        return true;
      }
    }
    return false;
  };

  const checkPassThroughRequest = (req, url) => {
    if (req.method !== 'GET') return true;
    if (req.mode === 'navigate') return false;
    if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return true;
    if (req.headers.has('Range')) return true;

    for (const path of PASSTHROUGH) {
      if (url.pathname.startsWith(path)) {
        return true;
      }
    }
    return false;
  };

  const checkOrigin = (url) => {
    return url.origin === origin;
  };

  const checkStatic = (req, url) => {
    if (req.destination === 'document') {
      return false;
    }

    for (const ext of STATIC) {
      if (url.pathname.endsWith(ext)) {
        return true;
      }
    }
    return false;
  };

  const getFreshOrCached = async (event, url, isStatic) => {
    let cache = null;
    let cached = null;
    try {
      cache = await caches.open(CACHE_NAME);
      cached = await cache.match(event.request);
    } catch (cacheError) {
      logMessage('[getFreshOrCached] cacheError:', event.request.url, cacheError);
    }

    const willRevalidate = shouldRevalidate(event.request, url);
    const fresh = (async () => {
      try {
        const response = await fetch(event.request, ((willRevalidate) ? { cache: 'no-cache' } : {}));
        if (cache && response?.ok && response.status === 200 && (response.type === 'basic' || event.request.mode === 'navigate' || response.type === 'cors')) {
          event.waitUntil(cache.put(event.request, response.clone()).catch(err => logMessage('[getFreshOrCached] [fetch] [cache.put] Cache update failed:', err)));
        }
        return response;
      } catch (err) {
        logMessage('[getFreshOrCached] [fetch] [respondWith] [fetch] ERROR:', event.request.url, err);
        return cacheOrException(event.request, `Error fetching fresh: ${event.request.url}`, isStatic);
      }
    });

    if (cached) {
      if (willRevalidate) {
        event.waitUntil(fresh());
      }
      return cached;
    }

    return (await fresh()) || cacheOrException(event.request, `can't reach a server: ${event.request.url}`, isStatic);
  };

  self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      if (cache) {
        await Promise.all(PRECACHE.map(url => cache.add(new Request(url, { cache: 'reload' })).catch(err => logMessage('[install] [cache.add] Failed to pre-cache', url, err))));
      }
      await self.skipWaiting();
    })());
  });

  self.addEventListener('fetch', (event) => {
    if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') return;

    const url = new URL(event.request.url);
    if (event.request.mode === 'navigate') {
      event.respondWith((async () => {
        if ('preloadResponse' in event) {
          try {
            const preload = await event.preloadResponse;
            if (preload) {
              return preload;
            }
          } catch (_e) {
            // ...silence
          }
        }

        try {
          return Promise.resolve(getFreshOrCached(event, url, false)).catch((err) => {
            logMessage('[fetch] [navigate] [respondWith] [getFreshOrCached] ERROR:', err);
            return offlineAssetFallback(event.request);
          });
        } catch (err) {
          logMessage('[fetch] [preload/fetch] Error:', err);
          return cacheOrException(event.request, `Error fetching fresh: ${event.request.url}`, false);
        }
      })());
      return;
    }

    if (!checkOrigin(url) || checkPassThroughRequest(event.request, url)) {
      return;
    }

    if (checkStatic(event.request, url)) {
      event.respondWith(Promise.resolve(getFreshOrCached(event, url, true)).catch((err) => {
        logMessage('[fetch] [isStatic] [respondWith] [getFreshOrCached] ERROR:', err);
        return offlineAssetFallback(event.request);
      }));
    }
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
      if ('navigationPreload' in self.registration) {
        try {
          await self.registration.navigationPreload.enable();
        } catch (err) {
          logMessage('[activate] [navigationPreload.enable] Error:', err);
        }
      }

      const cacheNames = await caches.keys();

      await Promise.all(cacheNames.filter((cacheName) => {
        return CACHE_NAME !== cacheName;
      }).map((cacheName) => {
        return caches.delete(cacheName).catch(err => logMessage('[activate] [caches.delete] Failed to delete cache by key', cacheName, err));
      }));

      await self.clients.claim();
    })());
  });

  self.addEventListener('push', (event) => {
    try {
      const message = event.data?.json?.() ?? DEFAULT_NOTIFICATION;
      if (message && message.title) {
        event.waitUntil(self.registration.showNotification(message.title, message));
      }
    } catch (_e) {
      // we're good here... just an old browser or non-JSON data
    }
  });

  self.addEventListener('notificationclick', async (event) => {
    event.notification.close();
    if (event.action === 'dismiss') {
      return;
    }

    const targetURL = event.notification?.data?.url;
    if (!targetURL) {
      return;
    }

    event.waitUntil((async () => {
      const availClients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: 'window'
      });

      const client = availClients.find((c) => 'focus' in c) || availClients[0];
      if (client) {
        try {
          await client.focus();
        } catch (_e) {
          // silence here...
        }

        client.postMessage({
          action: 'openRoute',
          url: targetURL,
        });
      } else {
        await self.clients.openWindow(targetURL);
      }
    })());
  });
})(this);
