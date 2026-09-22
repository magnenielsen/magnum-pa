const CACHE = "magnum-pa-v6";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./sounds/alarm.mp3",
  "./sounds/laugh.mp3",
  "./sounds/airhorn.mp3",
  "./sounds/applause.mp3",
  "./sounds/drumroll.mp3",
  "./sounds/ding.mp3",
  "./sounds/boing.mp3",
  "./sounds/buzzer.mp3",
  "./sounds/cheer.mp3",
  "./sounds/scratch.mp3"
];

// Cached one by one on purpose: cache.addAll() is atomic, so a single missing
// asset would abort the install and leave the app with no offline cache at all.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(ASSETS.map((a) => cache.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  // The app shell is network-first so a redeploy is picked up on the next
  // online launch; everything else is cache-first for instant start.
  const isShell = req.mode === "navigate" || new URL(req.url).pathname.endsWith("index.html");

  if (isShell) {
    // Bypass the HTTP cache, not just Cache Storage. GitHub Pages serves HTML
    // with max-age=600, so a plain fetch() here is answered by the browser's
    // own cache and "network-first" silently becomes "up to ten minutes old".
    e.respondWith(
      fetch(req.url, { cache: "no-store", credentials: "same-origin" }).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
        return res;
      }).catch(() => cached)
    )
  );
});
