// Renders sheaf on a real bundle with headless Chrome at 2x.
//   SHEAF_TOKEN=$(gh auth token) PUPPETEER_CORE=/path/to/node_modules/puppeteer-core \
//     node scripts/screenshot.mjs OUT.png '#t=...&p=...' [light|dark] [width] [height]
// The token goes into the page's sessionStorage, exactly as if pasted, and only to api.github.com.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createRequire } from "node:module";

const [out, hash = "", scheme = "dark", width = "1200", height = "900"] = process.argv.slice(2);
if (!out) throw new Error("usage: screenshot.mjs OUT.png '#hash' [light|dark] [width] [height]");
const puppeteer = createRequire(import.meta.url)(process.env.PUPPETEER_CORE || "puppeteer-core");
const root = new URL("..", import.meta.url).pathname;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

const server = createServer(async (req, res) => {
  const path = normalize(join(root, new URL(req.url, "http://x").pathname.replace(/\/$/, "/index.html")));
  if (!path.startsWith(root)) return res.writeHead(403).end();
  try { res.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream" }).end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
try {
  const page = await browser.newPage();
  page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
  await page.setViewport({ width: Number(width), height: Number(height), deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  if (process.env.SHEAF_TOKEN) await page.evaluateOnNewDocument((t) => sessionStorage.setItem("sheaf.token", t), process.env.SHEAF_TOKEN);
  await page.goto(`http://127.0.0.1:${server.address().port}/${hash}`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => !document.querySelector(".spin"), { timeout: 20000 });
  const flash = await page.$eval(".flash", (e) => e.textContent).catch(() => "");
  if (flash) console.error("flash:", flash);
  await page.screenshot({ path: out, fullPage: true });
  console.log(out);
} finally {
  await browser.close();
  server.close();
}
