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

// One reference per line (or comma). Duplicates are dropped, bad lines are returned.
export function parseList(text) {
  const prs = [], bad = [], seen = new Set();
  for (const line of text.split(/[\n,]/).map((l) => l.trim()).filter(Boolean)) {
    const ref = parseRef(line);
    if (!ref) { bad.push(line); continue; }
    const key = refKey(ref).toLowerCase();
    if (!seen.has(key)) { seen.add(key); prs.push(ref); }
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
