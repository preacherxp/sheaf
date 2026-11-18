import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { prepareShader } from "@vgpu/wgsl/prepare";
const shader = prepareShader(readFileSync(new URL("page.wgsl", import.meta.url), "utf8"));
await build({
  absWorkingDir: new URL(".", import.meta.url).pathname, entryPoints: ["page.js"],
  bundle: true, format: "iife", target: "es2022", minify: true, legalComments: "inline",
  banner: { js: `/*! vgpu\n${readFileSync(new URL("node_modules/vgpu/LICENSE", import.meta.url), "utf8")} */` },
  define: { PAGE_SHADER: JSON.stringify(shader) }, outfile: "../../snapshot-renderer.js",
});
