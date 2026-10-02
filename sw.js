// Bump this on any app-shell change so clients pick up the new files
// instead of getting stuck on a stale cache.
const CACHE_NAME = "spellit-v36";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=36",
  "./coach.css?v=36",
  "./app.js?v=36",
  "./words.js?v=36",
  "./ai.js?v=36",
  "./tts.js?v=36",
  "./sfx.js?v=36",
  "./meanings.js?v=36",
  "./sounds.js?v=36",
  "./word-info.js?v=36",
  "./neural-voice.js?v=36",
  "./neural-voice-worker.js",
  "./pronounce.js?v=36",
  "./delight.js?v=36",
  "./practice-content.js?v=36",
  "./srs.js?v=36",
  "./learning.js?v=36",
  "./learning-ui.js?v=36",
  "./coach.js?v=36",
  "./sync.js?v=36",
  "./manifest.json",
  "./icons/icon-192.png?v=36",
  "./icons/icon-512.png?v=36",
  "./icons/apple-touch-icon.png?v=36",
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

// The natural-voice engine (JavaScript and WebAssembly, ~25 MB) comes from a pinned jsDelivr version.
// Keep it so the voice still starts offline. Not named "spellit-*": activate() deletes those every release.
const ENGINE_CACHE = "neural-engine-v1";

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin === "https://cdn.jsdelivr.net" && event.request.method === "GET" && /@\d/.test(url.pathname)) {
    event.respondWith(caches.open(ENGINE_CACHE).then(async (cache) => {
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const res = await fetch(event.request);
      if (res.ok) cache.put(event.request, res.clone());
      return res;
    }));
    return;
  }
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
