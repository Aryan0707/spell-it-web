// Local full-app preview using the same request handler and SQL as the Worker.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { mkdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import worker from "./worker.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.PORT || 8765);
const storage = process.env.SPELLIT_DB_PATH || path.join(root, ".local", "sync.sqlite");
mkdirSync(path.dirname(storage), { recursive: true });
const database = new DatabaseSync(storage);
database.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
const DB = { prepare(sql) { return { bind(...values) { const statement = database.prepare(sql); return {
  first: async () => statement.get(...values) || null,
  run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } }),
}; } }; } };
const publicFiles = new Set(["index.html", "style.css", "coach.css", "app.js", "words.js", "ai.js", "tts.js", "sfx.js", "pronounce.js", "meanings.js", "neural-voice.js", "neural-voice-worker.js", "sounds.js", "word-info.js", "delight.js", "learning.js", "learning-ui.js", "coach.js", "sync.js", "practice-content.js", "srs.js", "sw.js", "manifest.json"]);
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const ASSETS = { async fetch(request) {
  const pathname = new URL(request.url).pathname;
  const name = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!publicFiles.has(name) && !/^icons\/[a-z0-9-]+\.(png|svg)$/.test(name)) return new Response("Not found", { status: 404 });
  try { return new Response(await readFile(path.join(root, name)), { headers: { "Content-Type": types[path.extname(name)] || "application/octet-stream", "Cache-Control": "no-cache" } }); }
  catch { return new Response("Not found", { status: 404 }); }
} };
createServer(async (req, res) => {
  try {
    const options = { method: req.method, headers: req.headers };
    if (!["GET", "HEAD"].includes(req.method)) { options.body = req; options.duplex = "half"; }
    const response = await worker.fetch(new Request(`http://${req.headers.host}${req.url}`, options), { DB, ASSETS });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end("Request failed"); }
}).listen(port, "127.0.0.1", () => console.log(`Spell It with sync: http://127.0.0.1:${port}`));
