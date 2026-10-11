// The one definition of which top-level files ship with the app. Both the build and the dev server use
// it, so a new module can no longer be built but 404 locally (or the reverse).
import { readdir } from "node:fs/promises";

// Non-JS entry files that must ship. Every top-level .js file ships too, found automatically.
export const REQUIRED = ["index.html", "style.css", "coach.css", "sw.js", "manifest.json"];

export async function publicFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const jsFiles = entries.filter((d) => d.isFile() && d.name.endsWith(".js")).map((d) => d.name);
  return { jsFiles, files: [...new Set([...REQUIRED, ...jsFiles])] };
}
