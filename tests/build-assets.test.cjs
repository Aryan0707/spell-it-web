const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdir, readdir, rm, writeFile } = require("node:fs/promises");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const distPath = path.join(projectRoot, "dist");
const publicFiles = [
  "index.html", "style.css", "coach.css", "app.js", "words.js", "ai.js", "tts.js",
  "sfx.js", "meanings.js", "neural-voice.js", "neural-voice-worker.js", "sounds.js", "word-info.js", "pronounce.js", "learning.js", "learning-ui.js", "chat.js", "reading.js", "reading-sync.js", "reading-passages.js", "reading-lesson.js", "packs.js", "packs-world.js", "packs-names.js", "coach.js", "sync.js", "practice-content.js",
  "sw.js", "manifest.json", "delight.js", "srs.js", "scoring.js",
];

async function treePaths(base, relative = "") {
  const entries = await readdir(path.join(base, relative), { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const item = path.posix.join(relative, entry.name);
    paths.push(item);
    if (entry.isDirectory()) paths.push(...await treePaths(base, item));
  }
  return paths;
}

test("a fresh build replaces stale output with only the approved public assets", async () => {
  const staleDir = path.join(distPath, ".vercel", "output", "diagnostics");
  await mkdir(staleDir, { recursive: true });
  await writeFile(path.join(staleDir, "project.json"), '{"private":"stale build artifact"}');

  try {
    execFileSync(process.execPath, ["server/build.mjs"], { cwd: projectRoot, stdio: "pipe" });
    const actual = await treePaths(distPath);
    const sourceIcons = await treePaths(path.join(projectRoot, "icons"));
    const expected = [...publicFiles, "icons", ...sourceIcons.map(item => `icons/${item}`)].sort();
    assert.deepEqual(actual.sort(), expected);
  } finally {
    await rm(path.join(distPath, ".vercel"), { recursive: true, force: true });
  }
});

test("the service worker caches every script the page loads, so a new module cannot be missing offline", async () => {
  const { readFile } = require("node:fs/promises");
  const html = await readFile(path.join(projectRoot, "index.html"), "utf8");
  const sw = await readFile(path.join(projectRoot, "sw.js"), "utf8");
  const scripts = [...html.matchAll(/<script src="([^"?]+\.js)\?v=(\d+)/g)].map((m) => ({ file: m[1], version: m[2] }));
  assert.ok(scripts.length > 10);
  for (const { file, version } of scripts) assert.ok(sw.includes(`"./${file}?v=${version}"`), `sw.js APP_SHELL is missing ${file}?v=${version}`);
});
