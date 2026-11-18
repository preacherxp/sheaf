// Only the build machine needs Bun. Embed the snapshot renderer and artwork in the executable.
import { readFile } from "node:fs/promises";
const assets = {};
for (const name of ["style.css", "glass.png", "dots.svg", "snapshot-renderer.js"])
  assets[name] = (await readFile(new URL(`../${name}`, import.meta.url))).toString("base64");
await Bun.build({
  entrypoints: ["./cli.mjs"],
  compile: { outfile: process.argv[2] || "dist/sheaf", ...(process.argv[3] && {target: process.argv[3]}), autoloadDotenv: false, autoloadBunfig: false },
  define: { SHEAF_ASSETS: JSON.stringify(assets) },
});
