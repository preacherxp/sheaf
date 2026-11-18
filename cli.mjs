#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { mkdir, writeFile, rename, readFile } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { decode, encode, parseList, ticketKey } from "./bundle.js";
import { searchTicket } from "./ticket.js";

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);

export async function snapshot(title, pairs, truncated = false) {
  const asset = name => readFile(new URL(name, import.meta.url));
  const [sheet, glass, dots, runtime] = await Promise.all(["style.css", "glass.png", "dots.svg", "snapshot-renderer.js"].map(asset));
  const script = runtime.toString().replace(/<\/script/gi, "<\\/script");
  const digest = createHash("sha256").update(script).digest("base64");
  const css = sheet.toString().replace("./glass.png", `data:image/png;base64,${glass.toString("base64")}`)
    .replace("./dots.svg", `data:image/svg+xml;base64,${dots.toString("base64")}`);
  const rows = pairs.map(({ ref, pr }) => {
    const repo = `${ref.owner}/${ref.repo}`;
    const label = `${repo} #${ref.number}`;
    const status = pr?.isDraft && pr.state === "OPEN" ? "Draft" : pr?.state?.toLowerCase() || "";
    return `<li class="row"><input class="review-check" type="checkbox" value="${esc(label.toLowerCase())}" aria-label="Checked ${esc(label)}"><div class="main"><a class="title ticket-title" href="https://github.com/${esc(repo)}/pull/${esc(ref.number)}">${esc(pr?.title || label)}</a><div class="sub reference">${esc(label)}</div></div><span class="state ${esc(status.toLowerCase())}">${esc(status)}</span></li>`;
  }).join("\n");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${digest}'; style-src 'unsafe-inline'; img-src data:"><title>${esc(title)} · sheaf</title><style>${css}
.row {grid-template-columns:auto minmax(0,1fr) auto;gap:12px;padding-inline:8px}.row .state {text-transform:capitalize}.snap {margin:16px 0 0;color:var(--muted)}
.glass-head{padding:24px 32px}.snap{margin:4px 0 0;font:12px/16px var(--mono)}
.queue{margin-top:24px;padding:20px 16px 8px;background:var(--glass);border:1px solid var(--line);border-radius:16px;box-shadow:inset 0 1px var(--edge),0 8px 32px var(--shade);backdrop-filter:blur(16px)}
.queue .list-heading{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;margin:0 8px 8px}
.queue progress{display:block;width:calc(100% - 16px);height:4px;margin:0 8px 16px;accent-color:var(--accent)}
.queue .rows{border:0}.queue .row:last-child{border:0}.reference{margin-top:4px}
.review-check {position:relative;z-index:3;width:32px;height:32px;margin:0;accent-color:var(--accent);cursor:pointer}.row:has(:checked) .ticket-title{color:var(--muted)}
@media screen and (forced-colors:none){body:has(#scene.ready) .review-check{opacity:0}}
#scene {position:fixed;inset:0;width:100%;height:100%;z-index:2;pointer-events:none;opacity:0} #scene.ready {opacity:1}
@media print,(forced-colors: active){#scene{display:none}}
</style><body><main><section class="wrap"><header class="head glass-head"><p class="eyebrow">sheaf / GitHub snapshot</p><h1>${esc(title)}</h1><p class="snap">${new Date().toISOString().slice(0,16).replace("T"," ")} UTC</p></header><section class="queue"><h2 class="list-heading">Pull requests <span class="result-count" role="status">0 of ${pairs.length} checked</span></h2><progress aria-label="Review progress" value="0" max="${Math.max(1,pairs.length)}"></progress>
${rows ? `<ul class="rows">${rows}</ul>` : "<p>No matching pull requests were visible to your account.</p>"}${truncated ? "<p>GitHub search returned only its first 1,000 candidates.</p>" : ""}</section></section></main><canvas id="scene" aria-hidden="true"></canvas><script>${script}</script></body></html>`;
}

// --token flag, then SHEAF_TOKEN / GH_TOKEN, then the one gh command.
function findToken(argv) {
  const flag = argv.find((a) => a.startsWith("--token="));
  if (flag?.length > 8) return { value: flag.slice(8), source: "--token" };
  if (process.env.SHEAF_TOKEN) return { value: process.env.SHEAF_TOKEN, source: "SHEAF_TOKEN" };
  if (process.env.GH_TOKEN) return { value: process.env.GH_TOKEN, source: "GH_TOKEN" };
  try {
    const value = execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (value) return { value, source: "gh auth token" };
  } catch {}
  return { value: "", source: "" };
}

// A shared link or #hash is used as is; anything else is parsed as a PR list.
export function hashFrom(arg) {
  if (!arg) return "";
  if (ticketKey(arg)) return `#ticket=${ticketKey(arg)}`;
  if (arg.startsWith("#")) return arg;
  if (arg.includes("://") && arg.includes("#") && !parseList(arg).prs.length) return arg.slice(arg.indexOf("#"));
  const { prs } = parseList(arg);
  return prs.length ? encode({ title: "", prs }) : "";
}

function openBrowser(url) {
  const [cmd, args] = { darwin: ["open", [url]], linux: ["xdg-open", [url]], win32: ["cmd", ["/c", "start", "", url]] }[process.platform] ?? [];
  if (!cmd) return;
  spawn(cmd, args, { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
}

async function main() {
  const args = process.argv.slice(2);
  const hash = hashFrom(args.find((a) => !a.startsWith("--token=")));
  const { title, ticket, prs } = decode(hash);
  if (!ticket && !prs.length) throw Error("Usage: npx . CC-1234   (or pass a quoted PR list)");
  let result = { pairs: prs.map(ref => ({ ref })) };
  if (ticket) {
    const { value } = findToken(args);
    if (!value) throw Error("Run gh auth login or set SHEAF_TOKEN to search GitHub.");
    result = await searchTicket(ticket, async (query, variables) => {
      const res = await fetch("https://api.github.com/graphql", { method: "POST", headers: { Authorization: `Bearer ${value}`, "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) });
      if (!res.ok) throw Error(`GitHub search failed (HTTP ${res.status}). Check your token and rate limit.`);
      const { data, errors } = await res.json();
      if (errors || !data) throw Error(errors?.[0]?.message || "GitHub returned no data.");
      return data;
    }, "id title number state isDraft");
  }
  const html = await snapshot(title || "Pull request bundle", result.pairs, result.truncated);
  await mkdir(".sheaf", { recursive: true, mode: 0o700 });
  const path = resolve(".sheaf", `${ticket || "bundle"}.html`);
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, html, { flag: "wx", mode: 0o600 });
  await rename(tmp, path);
  console.log(`${result.pairs.length} pull requests · ${path}`);
  openBrowser(pathToFileURL(path).href);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main().catch(e => { console.error(e.message); process.exitCode = 1; });
