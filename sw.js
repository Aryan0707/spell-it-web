// Bump this on any app-shell change so clients pick up the new files
// instead of getting stuck on a stale cache.
const CACHE_NAME = "spellit-v61";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?v=61",
  "./coach.css?v=61",
  "./app.js?v=61",
  "./words.js?v=61",
  "./ai.js?v=61",
  "./tts.js?v=61",
  "./sfx.js?v=61",
  "./meanings.js?v=61",
  "./sounds.js?v=61",
  "./word-info.js?v=61",
  "./neural-voice.js?v=61",
  "./neural-voice-worker.js",
  "./pronounce.js?v=61",
  "./delight.js?v=61",
  "./practice-content.js?v=61",
  "./srs.js?v=61",
  "./scoring.js?v=61",
  "./learning.js?v=61",
  "./learning-ui.js?v=61",
  "./chat.js?v=61",
  "./reading-passages.js?v=61",
  "./reading.js?v=61",
  "./reading-sync.js?v=61",
  "./reading-daily.js?v=61",
  "./reading-words.js?v=61",
  "./reading-generated.js?v=61",
  "./reading-chart.js?v=61",
  "./reading-custom.js?v=61",
  "./reading-listen.js?v=61",
  "./reading-a11y.js?v=61",
  "./reading-lesson.js?v=61",
  "./packs.js?v=61",
  "./coach.js?v=61",
  "./sync.js?v=61",
  "./manifest.json",
  "./icons/icon-192.png?v=61",
  "./icons/icon-512.png?v=61",
  "./icons/apple-touch-icon.png?v=61",
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
