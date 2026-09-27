import { mkdir, copyFile, cp, rm, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const destination = new URL("../dist/", import.meta.url);

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

// Explicit list of non-JS entry files that must ship.
const REQUIRED = ["index.html", "style.css", "coach.css", "sw.js", "manifest.json"];

// Auto-discover every top-level .js file so a new module can't be forgotten.
const entries = await readdir(root, { withFileTypes: true });
const jsFiles = entries
  .filter((d) => d.isFile() && d.name.endsWith(".js"))
  .map((d) => d.name);

const files = [...new Set([...REQUIRED, ...jsFiles])];

// Sanity-check that every .js file referenced by index.html is present on disk.
const html = await readFile(new URL("index.html", root), "utf8");
const referenced = [...html.matchAll(/src="([^"?]+\.js)(?:\?[^"]*)?"/g)].map((m) => m[1]);
const missing = referenced.filter((f) => !files.includes(f));
if (missing.length) {
  console.error(`ERROR: index.html references files that are not on disk: ${missing.join(", ")}`);
  process.exit(1);
}

// Warn if a .js file on disk isn't referenced anywhere (silently shipped dead code).
const swSrc = await readFile(new URL("sw.js", root), "utf8");
const unreferenced = jsFiles.filter(
  (f) => f !== "sw.js" && !html.includes(f) && !swSrc.includes(f)
);
if (unreferenced.length) {
  console.warn(`WARN: .js files present but not referenced by index.html or sw.js: ${unreferenced.join(", ")}`);
}

for (const name of files) {
  await copyFile(new URL(name, root), new URL(name, destination));
}
await cp(new URL("icons/", root), new URL("icons/", destination), { recursive: true });
console.log(`Public app files prepared in ${fileURLToPath(destination)} (${files.length} files)`);
