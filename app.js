import { parseList, encode, decode } from "./bundle.js";

// A framed copy could trick a click on "Mark seen", so never run inside a frame.
if (window.top !== window.self) {
  document.documentElement.hidden = true;
  throw new Error("sheaf does not run inside a frame");
}

const API = "https://api.github.com/graphql";
const KEY = "sheaf.token";
const MAX = 50; // ponytail: one GraphQL query per bundle; page through it if bundles ever get bigger
const app = document.getElementById("app");
const who = document.getElementById("who");

// The token stays in this tab unless the user ticks "Remember", and is only ever sent to api.github.com.
const token = {
  get: () => sessionStorage.getItem(KEY) || localStorage.getItem(KEY),
  set(value, remember) { this.clear(); (remember ? localStorage : sessionStorage).setItem(KEY, value); },
  clear() { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); },
};

const ICONS = {
  open: '<path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/>',
  merged: '<path d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z"/>',
  closed: '<path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 5.5a.75.75 0 0 1 .75.75v3.378a2.251 2.251 0 1 1-1.5 0V7.25a.75.75 0 0 1 .75-.75Zm-2.03-5.273a.75.75 0 0 1 1.06 0l.97.97.97-.97a.748.748 0 0 1 1.265.332.75.75 0 0 1-.205.729l-.97.97.97.97a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-.97-.97-.97.97a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l.97-.97-.97-.97a.75.75 0 0 1 0-1.06ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/>',
  draft: '<path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 14a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM14 7.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm0-4.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z"/>',
  check: '<path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>',
  x: '<path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>',
  dot: '<path d="M8 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"/>',
  eye: '<path d="M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.83.88 9.576.43 8.898a1.62 1.62 0 0 1 0-1.798c.45-.677 1.367-1.931 2.637-3.022C4.33 2.992 6.019 2 8 2ZM1.679 7.932a.12.12 0 0 0 0 .136c.411.622 1.241 1.75 2.366 2.717C5.176 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.124-.967 1.954-2.096 2.366-2.717a.12.12 0 0 0 0-.136c-.412-.621-1.242-1.75-2.366-2.717C10.824 4.242 9.473 3.5 8 3.5c-1.473 0-2.825.742-3.955 1.715-1.124.967-1.954 2.096-2.366 2.717ZM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10Z"/>',
  copy: '<path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>',
  sync: '<path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z"/>',
  pencil: '<path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z"/>',
};

// Builds elements from data without ever parsing it as HTML.
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  el.append(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  return el;
}

function icon(name, cls = "") {
  const span = h("span", { class: `octicon ${cls}`, "aria-hidden": "true" });
  span.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">${ICONS[name]}</svg>`; // constants only
  return span;
}

const safeUrl = (url, prefix) => (typeof url === "string" && url.startsWith(prefix) ? url : null);
const avatar = (user, size = 20) =>
  h("img", { class: "avatar", src: safeUrl(user?.avatarUrl, "https://avatars.githubusercontent.com/"), alt: "", width: size, height: size, title: user?.login });

// --- GitHub ---------------------------------------------------------------

async function gql(query, variables, strict = false) {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `bearer ${token.get()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    credentials: "omit",
    referrerPolicy: "no-referrer",
    cache: "no-store",
  });
  if (res.status === 401) throw Object.assign(new Error("GitHub rejected the token. Paste a new one."), { auth: true });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} ${res.statusText}.`);
  const body = await res.json();
  if (!body.data || (strict && body.errors)) throw new Error(body.errors?.[0]?.message || "GitHub returned no data.");
  return body.data;
}

const FIELDS = `id url number title state isDraft merged reviewDecision
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  eyes: reactions(content: EYES, first: 30) { totalCount nodes { user { login avatarUrl(size: 40) } } }
  reactionGroups { content viewerHasReacted }`;

function loadQuery(prs) {
  const defs = prs.map((_, i) => `$o${i}: String!, $r${i}: String!, $n${i}: Int!`).join(", ");
  const parts = prs.map((_, i) => `p${i}: repository(owner: $o${i}, name: $r${i}) { pullRequest(number: $n${i}) { ${FIELDS} } }`).join("\n");
  const vars = Object.fromEntries(prs.flatMap((p, i) => [[`o${i}`, p.owner], [`r${i}`, p.repo], [`n${i}`, p.number]]));
  return [`query(${defs}) { viewer { login avatarUrl(size: 40) } ${parts} }`, vars];
}

const REACT = (verb) => `mutation($id: ID!) { ${verb}(input: { subjectId: $id, content: EYES }) { clientMutationId } }`;

// --- State ----------------------------------------------------------------

let bundle = decode(location.hash);
let state = { rows: null, viewer: null, error: "", busy: false, loadedAt: 0 };

async function load() {
  if (!token.get() || !bundle.prs.length) return render();
  state.busy = true;
  render();
  try {
    const prs = bundle.prs.slice(0, MAX);
    const data = await gql(...loadQuery(prs));
    state.viewer = data.viewer;
    state.rows = prs.map((ref, i) => {
      const pr = data[`p${i}`]?.pullRequest ?? null;
      const seen = !!pr?.reactionGroups?.find((g) => g.content === "EYES")?.viewerHasReacted;
      return { ref, pr, seen };
    });
    state.error = "";
    state.loadedAt = Date.now();
  } catch (e) {
    if (e.auth) token.clear();
    state.error = e.message;
  }
  state.busy = false;
  render();
}

async function react(rows) {
  state.busy = true;
  render();
  try {
    for (const row of rows) await gql(REACT(row.seen ? "removeReaction" : "addReaction"), { id: row.pr.id }, true);
  } catch (e) {
    state.error = /permission|scope|not accessible/i.test(e.message)
      ? `${e.message} Adding 👀 needs a token that can write to pull requests.`
      : e.message;
    state.busy = false;
    return render();
  }
  await load();
}

// --- Views ----------------------------------------------------------------

function render() {
  document.title = bundle.title ? `${bundle.title} · sheaf` : "sheaf";
  who.replaceChildren(
    ...(state.viewer && token.get()
      ? [avatar(state.viewer), h("span", {}, state.viewer.login), h("button", { class: "btn-link", onclick: forget }, "Forget token")]
      : []),
  );
  app.replaceChildren(bundle.prs.length ? bundleView() : composeView());
}

function forget() {
  token.clear();
  state = { rows: null, viewer: null, error: "", busy: false, loadedAt: 0 };
  render();
}

function composeView() {
  const title = h("input", { id: "title", class: "input", placeholder: "Bump actions/checkout to v6", value: bundle.title, maxlength: 200 });
  const list = h("textarea", {
    id: "list", class: "input", rows: 6, spellcheck: "false",
    placeholder: "https://github.com/acme/api/pull/412\nacme/web#97\nacme/worker/pull/31",
  });
  const hint = h("p", { class: "hint" });
  const go = h("button", { class: "btn", type: "submit", disabled: true }, "Create link");
  const update = () => {
    const { prs, bad } = parseList(list.value);
    go.disabled = !prs.length;
    hint.replaceChildren(
      `${prs.length} pull request${prs.length === 1 ? "" : "s"}`,
      bad.length ? h("span", { class: "bad" }, ` · not a pull request: ${bad.slice(0, 3).join(", ")}${bad.length > 3 ? "…" : ""}`) : "",
    );
  };
  list.addEventListener("input", update);
  const form = h("form", {
    class: "compose",
    onsubmit: (e) => {
      e.preventDefault();
      location.hash = encode({ title: title.value, prs: parseList(list.value).prs });
    },
  },
    h("label", { for: "title" }, "Title"), title,
    h("label", { for: "list" }, "Pull requests, one per line"), list,
    h("div", { class: "compose-foot" }, hint, go),
  );
  update();
  return h("section", { class: "wrap" },
    h("h1", { class: "hero" }, "One link for the same pull request in every repository"),
    h("p", { class: "lede" }, "The list lives in the link, after the #, so it never reaches a server."),
    form,
  );
}

function tokenCard() {
  const input = h("input", { class: "input", type: "password", autocomplete: "off", spellcheck: "false", placeholder: "GitHub token to load these", "aria-label": "GitHub token", required: true });
  const remember = h("input", { type: "checkbox", id: "remember" });
  return h("form", {
    class: "token",
    onsubmit: (e) => {
      e.preventDefault();
      token.set(input.value.trim(), remember.checked);
      load();
    },
  },
    h("div", { class: "token-row" }, input, h("button", { class: "btn", type: "submit" }, "Connect")),
    h("label", { class: "check" }, remember, " Remember on this device"),
    h("details", {},
      h("summary", {}, "Which token? It goes only to api.github.com"),
      h("p", {}, "A fine-grained token with ", h("b", {}, "Pull requests: read and write"), " on the repositories (write is only used for 👀), or a classic token with ", h("code", {}, "repo"), ". If you use the GitHub CLI, ", h("code", {}, "gh auth token"), " prints one."),
    ),
  );
}

function stateOf(pr) {
  if (!pr) return "missing";
  if (pr.merged) return "merged";
  if (pr.state === "CLOSED") return "closed";
  return pr.isDraft ? "draft" : "open";
}

const CHECKS = { SUCCESS: ["check", "ok", "Checks passed"], FAILURE: ["x", "fail", "Checks failed"], ERROR: ["x", "fail", "Checks errored"], PENDING: ["dot", "wait", "Checks running"], EXPECTED: ["dot", "wait", "Checks expected"] };
const REVIEW = { APPROVED: ["approved", "ok"], CHANGES_REQUESTED: ["changes requested", "fail"], REVIEW_REQUIRED: ["review required", ""] };

// The title most pull requests share; rows only repeat a title that differs from it.
function commonTitle(found) {
  const n = {};
  for (const r of found) n[r.pr.title] = (n[r.pr.title] || 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

function rowView(row, common) {
  const { ref, pr, seen } = row;
  const kind = stateOf(pr);
  const href = pr ? safeUrl(pr.url, "https://github.com/") : `https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number}`;
  const link = h("a", { class: "title", href }, h("span", { class: "owner" }, `${ref.owner}/`), h("b", {}, ref.repo), h("span", { class: "num" }, ` #${ref.number}`));
  if (!pr) {
    return h("li", { class: "row" },
      h("span", { class: "state missing" }, icon("open")),
      h("div", { class: "main" }, link, h("div", { class: "sub" }, state.rows ? "not found, or your token can't see it" : "")),
    );
  }
  const checks = CHECKS[pr.commits.nodes[0]?.commit.statusCheckRollup?.state];
  const review = REVIEW[pr.reviewDecision];
  const eyes = pr.eyes.nodes.map((n) => n.user).filter(Boolean);
  return h("li", { class: `row${seen ? " is-seen" : ""}` },
    h("span", { class: `state ${kind}`, title: kind[0].toUpperCase() + kind.slice(1) }, icon(kind)),
    h("div", { class: "main" },
      h("div", { class: "line" },
        link,
        checks && h("span", { class: `checks ${checks[1]}`, title: checks[2] }, icon(checks[0])),
        review && h("span", { class: `review ${review[1]}` }, review[0]),
      ),
      pr.title !== common && h("div", { class: "sub" }, pr.title),
    ),
    h("div", { class: "eyes", title: eyes.length ? `Seen by ${eyes.map((u) => u.login).join(", ")}` : "" },
      eyes.slice(0, 5).map((u) => avatar(u, 18)),
      pr.eyes.totalCount > 5 && h("span", { class: "more" }, `+${pr.eyes.totalCount - 5}`),
    ),
    h("button", {
      class: `eye${seen ? " on" : ""}`, "aria-pressed": String(seen), disabled: state.busy,
      "aria-label": seen ? `Unmark ${ref.repo} seen` : `Mark ${ref.repo} seen`,
      title: seen ? "Seen. Click to remove your 👀" : "Mark seen with 👀",
      onclick: () => react([row]),
    }, icon("eye")),
  );
}

function bundleView() {
  const rows = state.rows ?? bundle.prs.slice(0, MAX).map((ref) => ({ ref, pr: null, seen: false }));
  const found = rows.filter((r) => r.pr);
  const count = (k) => found.filter((r) => stateOf(r.pr) === k).length;
  const mine = found.filter((r) => r.seen).length;
  const unseen = found.filter((r) => !r.seen);
  const common = commonTitle(found);

  // People who put 👀 on every pull request that could be read.
  const everyone = found.length
    ? found.map((r) => r.pr.eyes.nodes.map((n) => n.user).filter(Boolean))
        .reduce((acc, users) => acc.filter((a) => users.some((u) => u.login === a.login)))
    : [];

  const copy = h("button", {
    class: "quiet",
    onclick: async () => {
      await navigator.clipboard.writeText(location.href);
      copy.textContent = "Copied";
      setTimeout(() => (copy.textContent = "Copy link"), 1500);
    },
  }, "Copy link");

  const n = bundle.prs.length;
  const stats = state.rows
    ? [
        `${n} pull request${n === 1 ? "" : "s"}`,
        count("open") + count("draft") && `${count("open") + count("draft")} open`,
        count("merged") && `${count("merged")} merged`,
        count("closed") && `${count("closed")} closed`,
        `you've seen ${mine} of ${found.length}`,
      ].filter(Boolean).join(" · ")
    : `${n} pull request${n === 1 ? "" : "s"}`;

  return h("section", { class: "wrap" },
    h("div", { class: "head" },
      h("h1", {}, bundle.title || common || "Untitled bundle"),
      h("div", { class: "actions" },
        copy,
        h("button", { class: "quiet", onclick: () => { location.hash = ""; app.replaceChildren(composeFor()); } }, "Edit"),
        token.get() && h("button", { class: "quiet icon-only", onclick: load, disabled: state.busy, "aria-label": "Refresh", title: "Refresh" }, icon("sync", state.busy ? "spin" : "")),
      ),
    ),
    h("p", { class: "meta" },
      stats,
      state.rows && unseen.length > 0 && [" · ", h("button", { class: "link", disabled: state.busy, onclick: () => react(unseen) }, "mark all seen")],
      everyone.length > 0 && h("span", { class: "everyone", title: "Seen every pull request" }, everyone.slice(0, 8).map((u) => avatar(u, 18))),
    ),
    common && bundle.title && common !== bundle.title && h("p", { class: "common" }, common),
    state.error && h("p", { class: "flash", role: "alert" }, state.error),
    !token.get() && tokenCard(),
    h("ul", { class: "rows" }, rows.map((r) => rowView(r, common))),
    bundle.prs.length > MAX && h("p", { class: "hint" }, `Showing the first ${MAX} of ${bundle.prs.length}.`),
  );
}

// Edit keeps the current list: go back to the form, prefilled.
function composeFor() {
  const { title, prs } = bundle;
  bundle = { title, prs: [] };
  const view = composeView();
  view.querySelector("#list").value = prs.map((p) => `https://github.com/${p.owner}/${p.repo}/pull/${p.number}`).join("\n");
  view.querySelector("#list").dispatchEvent(new Event("input"));
  return view;
}

window.addEventListener("hashchange", () => {
  const next = decode(location.hash);
  if (next.prs.length === 0 && !location.hash) return; // Edit cleared the hash on purpose
  bundle = next;
  state.rows = null;
  load();
});

// Coming back from a pull request tab is when 👀 most likely changed.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && token.get() && bundle.prs.length && !state.busy && Date.now() - state.loadedAt > 15000) load();
});

load();
