// Bump this on any app-shell change so clients pick up the new files
// instead of getting stuck on a stale cache.
const CACHE_NAME = "spellit-v60";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=60",
  "./coach.css?v=60",
  "./app.js?v=60",
  "./words.js?v=60",
  "./ai.js?v=60",
  "./tts.js?v=60",
  "./sfx.js?v=60",
  "./meanings.js?v=60",
  "./sounds.js?v=60",
  "./word-info.js?v=60",
  "./neural-voice.js?v=60",
  "./neural-voice-worker.js",
  "./pronounce.js?v=60",
  "./delight.js?v=60",
  "./practice-content.js?v=60",
  "./srs.js?v=60",
  "./scoring.js?v=60",
  "./learning.js?v=60",
  "./learning-ui.js?v=60",
  "./chat.js?v=60",
  "./reading-passages.js?v=60",
  "./reading.js?v=60",
  "./reading-sync.js?v=60",
  "./reading-daily.js?v=60",
  "./reading-words.js?v=60",
  "./reading-generated.js?v=60",
  "./reading-chart.js?v=60",
  "./reading-custom.js?v=60",
  "./reading-listen.js?v=60",
  "./reading-a11y.js?v=60",
  "./reading-lesson.js?v=60",
  "./packs.js?v=60",
  "./coach.js?v=60",
  "./sync.js?v=60",
  "./manifest.json",
  "./icons/icon-192.png?v=60",
  "./icons/icon-512.png?v=60",
  "./icons/apple-touch-icon.png?v=60",
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
  // Pack data (packs-<id>.js) is deliberately not in the shell above: it is cached the first time a pack is used,
  // by the network-first handler below, and works offline from then on.
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
