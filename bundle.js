// The bundle lives in the URL hash, so nothing is stored anywhere:
//   #t=Bump%20checkout&p=grafana/faro/128,grafana/lambda-promtail/234

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

// Accepts a PR URL, owner/repo#123 or owner/repo/123. Returns null for anything else.
export function parseRef(text) {
  let s = text.trim();
  const host = /^(https?:\/\/)?(www\.)?github\.com\//;
  if (host.test(s)) s = s.replace(host, "").replace(/[?#].*$/, "").replace(/\/(files|commits|checks)\/?$/, "");
  const m = s.match(/^([^/\s]+)\/([^/\s#]+)(?:\/pull\/|\/pulls\/|#|\/)(\d+)\/?$/);
  if (!m || !NAME.test(m[1]) || !NAME.test(m[2])) return null;
  const number = Number(m[3]);
  return number > 0 && number < 2 ** 31 ? { owner: m[1], repo: m[2], number } : null;
}

const PR_URL = /(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)\/pulls?\/(\d+)/gi;

// A line is a reference, or any text with PR links in it (a Slack message, a Markdown
// list), or comma separated references. Duplicates are dropped, unusable text is returned.
export function parseList(text) {
  const prs = [], bad = [], seen = new Set();
  const add = (ref) => {
    const key = refKey(ref).toLowerCase();
    if (!seen.has(key)) { seen.add(key); prs.push(ref); }
  };
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const whole = parseRef(line);
    if (whole) { add(whole); continue; }
    const linked = [...line.matchAll(PR_URL)].map((m) => parseRef(`${m[1]}/${m[2]}/${m[3]}`)).filter(Boolean);
    if (linked.length) { linked.forEach(add); continue; }
    const pieces = line.split(",").map((p) => p.trim()).filter(Boolean);
    const refs = pieces.map(parseRef);
    if (!refs.some(Boolean)) { bad.push(line); continue; }
    refs.forEach((ref, i) => (ref ? add(ref) : bad.push(pieces[i])));
  }
  return { prs, bad };
}

export const refKey = (r) => `${r.owner}/${r.repo}/${r.number}`;

export function encode({ title, prs }) {
  const t = title.trim() ? `t=${encodeURIComponent(title.trim())}&` : "";
  return `#${t}p=${prs.map(refKey).join(",")}`;
}

export function decode(hash) {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const { prs } = parseList(q.get("p") || "");
  return { title: (q.get("t") || "").slice(0, 200), prs };
}
