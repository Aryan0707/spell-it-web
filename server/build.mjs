import { mkdir, copyFile, cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const destination = new URL("../dist/", import.meta.url);
await mkdir(destination, { recursive: true });
for (const name of ["index.html", "style.css", "coach.css", "app.js", "words.js", "ai.js", "tts.js", "sfx.js", "learning.js", "learning-ui.js", "coach.js", "sync.js", "practice-content.js", "sw.js", "manifest.json"]) {
  await copyFile(new URL(name, root), new URL(name, destination));
}
await cp(new URL("icons/", root), new URL("icons/", destination), { recursive: true });
console.log(`Public app files prepared in ${fileURLToPath(destination)}`);
