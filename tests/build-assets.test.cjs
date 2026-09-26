const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdir, readdir, rm, writeFile } = require("node:fs/promises");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const distPath = path.join(projectRoot, "dist");
const publicFiles = [
  "index.html", "style.css", "coach.css", "app.js", "words.js", "ai.js", "tts.js",
  "sfx.js", "pronounce.js", "learning.js", "learning-ui.js", "coach.js", "sync.js", "practice-content.js",
  "sw.js", "manifest.json", "delight.js",
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
