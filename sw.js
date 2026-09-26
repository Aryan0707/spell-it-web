// Bump this on any app-shell change so clients pick up the new files
// instead of getting stuck on a stale cache.
const CACHE_NAME = "spellit-v25";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=25",
  "./coach.css?v=25",
  "./app.js?v=25",
  "./words.js?v=25",
  "./ai.js?v=25",
  "./tts.js?v=25",
  "./sfx.js?v=25",
  "./practice-content.js?v=25",
  "./learning.js?v=25",
  "./learning-ui.js?v=25",
  "./coach.js?v=25",
  "./sync.js?v=25",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
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
