const CACHE_NAME = "quizmoi-v11";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js?v=11",
  "./firebase-config.js",
  "./firebase-db.js",
  "./content-data.js",
  "./gamer-quizzes-data.js",
  "./gamer-games-extra.js",
  "./gamer-wat-data.js",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isAppShell = url.pathname.endsWith(".js") || url.pathname.endsWith(".html");

  event.respondWith(
    (isAppShell
      ? fetch(request).catch(() => caches.match(request))
      : caches.match(request).then((cached) => {
          const network = fetch(request)
            .then((response) => {
              if (response && response.status === 200 && response.type === "basic") {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
              }
              return response;
            })
            .catch(() => cached);
          return cached || network;
        })
    ).then((response) => {
      if (response) return response;
      return fetch(request);
    }).then((response) => {
      if (isAppShell && response && response.status === 200 && response.type === "basic") {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })
  );
});
