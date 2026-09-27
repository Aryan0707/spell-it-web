// Bump this on any app-shell change so clients pick up the new files
// instead of getting stuck on a stale cache.
const CACHE_NAME = "spellit-v27";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=27",
  "./coach.css?v=27",
  "./app.js?v=27",
  "./words.js?v=27",
  "./ai.js?v=27",
  "./tts.js?v=27",
  "./sfx.js?v=27",
  "./pronounce.js?v=27",
  "./delight.js?v=27",
  "./practice-content.js?v=27",
  "./srs.js?v=27",
  "./learning.js?v=27",
  "./learning-ui.js?v=27",
  "./coach.js?v=27",
  "./sync.js?v=27",
  "./manifest.json",
  "./icons/icon-192.png?v=27",
  "./icons/icon-512.png?v=27",
  "./icons/apple-touch-icon.png?v=27",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("spellit-") && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Never intercept cross-origin calls (OpenRouter, ElevenLabs) — only cache our own app shell.
  if (url.origin !== self.location.origin || event.request.method !== "GET" || url.pathname.startsWith("/api/") || event.request.headers.has("Authorization")) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || (event.request.mode === "navigate" ? caches.match("./index.html") : Response.error())))
  );
});
