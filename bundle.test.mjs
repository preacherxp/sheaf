import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRef, parseList, encode, decode } from "./bundle.js";

test("parseRef accepts URLs and short forms, rejects junk", () => {
  const faro = { owner: "grafana", repo: "faro", number: 128 };
  assert.deepEqual(parseRef("https://github.com/grafana/faro/pull/128"), faro);
  assert.deepEqual(parseRef("https://github.com/grafana/faro/pull/128/files?w=1"), faro);
  assert.deepEqual(parseRef("github.com/grafana/faro/pull/128#issuecomment-1"), faro);
  assert.deepEqual(parseRef(" grafana/faro#128 "), faro);
  assert.deepEqual(parseRef("grafana/faro/128"), faro);
  assert.deepEqual(parseRef("a.b/c-d_e/1"), { owner: "a.b", repo: "c-d_e", number: 1 });
  for (const bad of ["", "faro#128", "grafana/faro", "grafana/faro#0", "g<x>/faro#1", "https://gitlab.com/a/b/pull/1", "grafana/faro#99999999999"])
    assert.equal(parseRef(bad), null, bad);
});

test("parseList dedupes case-insensitively and reports bad lines", () => {
  const { prs, bad } = parseList("grafana/faro#128\nhttps://github.com/Grafana/Faro/pull/128\n\nnope, grafana/loki#2");
  assert.deepEqual(prs.map((p) => p.repo), ["faro", "loki"]);
  assert.deepEqual(bad, ["nope"]);
});

test("parseList accepts any line that contains a PR link", () => {
  const text = [
    "- [ ] api: https://github.com/acme/api/pull/412 (needs a second look)",
    "Bump in web too, see github.com/acme/web/pull/97.",
    "[worker](https://github.com/acme/worker/pull/31/files) and https://github.com/acme/cron/pull/8#discussion_r1",
    "<https://github.com/acme/api/pull/412|acme/api#412> dup from Slack",
    "https://github.com/acme/api/issues/5 is an issue, not a PR",
  ].join("\n");
  const { prs, bad } = parseList(text);
  assert.deepEqual(prs.map((p) => `${p.repo}#${p.number}`), ["api#412", "web#97", "worker#31", "cron#8"]);
  assert.equal(bad.length, 1);
});

test("encode and decode round trip, title with symbols survives", () => {
  const bundle = { title: "Bump checkout & co: v6 #1", prs: parseList("grafana/faro#128\ngrafana/lambda-promtail#234").prs };
  const hash = encode(bundle);
  assert.equal(hash.split("&p=")[1], "grafana/faro/128,grafana/lambda-promtail/234");
  assert.deepEqual(decode(hash), bundle);
  assert.deepEqual(decode("#p=grafana/faro/128,<script>/x/1"), { title: "", prs: [bundle.prs[0]] });
  assert.equal(encode({ title: " ", prs: [] }), "#p=");
});
