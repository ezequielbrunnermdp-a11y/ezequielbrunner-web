/* BIG FUN – service worker: permite abrir la app aunque la señal sea mala.
 * Los consumos NO pasan por acá: se guardan en localStorage del teléfono. */
var CACHE = "bigfun-b2f4192abd";
var CORE = [
  "./", "styles.css?v=b2f4192abd", "config.js?v=b2f4192abd",
  "catalog.js?v=b2f4192abd", "core.js?v=b2f4192abd", "app.js?v=b2f4192abd",
  "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  // Página: primero la red (para tomar actualizaciones); sin señal, la copia guardada.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put("./", copy); });
      }
      return res;
    }).catch(function () { return caches.match("./"); }));
    return;
  }

  // Recursos: copia guardada primero; si no está, se descarga y se guarda.
  e.respondWith(caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      if (res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    });
  }));
});
