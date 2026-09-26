// Bump this on any app-shell change so clients pick up the new files
// instead of getting stuck on a stale cache.
const CACHE_NAME = "spellit-v23";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=23",
  "./coach.css?v=23",
  "./app.js?v=23",
  "./words.js?v=23",
  "./ai.js?v=23",
  "./tts.js?v=23",
  "./sfx.js?v=23",
  "./practice-content.js?v=23",
  "./learning.js?v=23",
  "./learning-ui.js?v=23",
  "./coach.js?v=23",
  "./sync.js?v=23",
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
