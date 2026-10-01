// Bump this on any app-shell change so clients pick up the new files
// instead of getting stuck on a stale cache.
const CACHE_NAME = "spellit-v35";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=35",
  "./coach.css?v=35",
  "./app.js?v=35",
  "./words.js?v=35",
  "./ai.js?v=35",
  "./tts.js?v=35",
  "./sfx.js?v=35",
  "./meanings.js?v=35",
  "./sounds.js?v=35",
  "./word-info.js?v=35",
  "./neural-voice.js?v=35",
  "./neural-voice-worker.js",
  "./pronounce.js?v=35",
  "./delight.js?v=35",
  "./practice-content.js?v=35",
  "./srs.js?v=35",
  "./learning.js?v=35",
  "./learning-ui.js?v=35",
  "./coach.js?v=35",
  "./sync.js?v=35",
  "./manifest.json",
  "./icons/icon-192.png?v=35",
  "./icons/icon-512.png?v=35",
  "./icons/apple-touch-icon.png?v=35",
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
