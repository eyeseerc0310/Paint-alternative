// Works offline: everything the app needs is kept in a cache. When online,
// the newest version is always fetched first (so updates show straight
// away), and the cache is only used when the network isn't there.
var CACHE = 'paint-alternative-raw-decoders-20261028';
var SHELL = ['./', 'index.html', 'style.css?v=raw-decoders-20261028', 'fx-shared.js?v=raw-decoders-20261028', 'decoders.js?v=raw-decoders-20261028', 'photo.js?v=raw-decoders-20261028', 'vector.js?v=raw-decoders-20261028', 'paint.js?v=raw-decoders-20261028', 'color-controls.css?v=6', 'color-controls.js?v=2', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL.map(function (path) { return new Request(path, { cache: 'reload' }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('paint-alternative-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // the font (from Google): from the cache if it's there, refreshed behind
  if (url.origin !== location.origin) {
    if (!/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(function () { return hit; });
        return hit || net;
      });
    }));
    return;
  }
  // the app itself: the network first, the cache when offline
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(function (res) {
    if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined); });
  }));
});








