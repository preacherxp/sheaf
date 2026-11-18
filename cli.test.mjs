import { test } from "node:test";
import assert from "node:assert/strict";
import { snapshot, hashFrom } from "./cli.mjs";

test("hashFrom takes links as hashes and encodes PR lists", () => {
  assert.equal(hashFrom("grafana/faro#128, grafana/loki#2"), "#p=grafana/faro/128,grafana/loki/2");
  assert.equal(hashFrom("https://preacherxp.github.io/sheaf/#t=x&p=a/b/1"), "#t=x&p=a/b/1");
  assert.equal(hashFrom("#t=x&p=a/b/1"), "#t=x&p=a/b/1");
  assert.equal(hashFrom("no prs here"), "");
  assert.equal(hashFrom(""), "");
});

test("the standalone snapshot embeds its artwork, escapes titles and links directly to GitHub", async () => {
  const html = await snapshot("CC-1234", [{ ref: {owner:"acme", repo:"api", number:7}, pr:{title:"<script> & fix",state:"MERGED"} }]);
  assert.match(html, /data:image\/png;base64,/);
  assert.match(html, /https:\/\/github.com\/acme\/api\/pull\/7/);
  assert.match(html, /&lt;script&gt; &amp; fix/);
  assert.equal(html.match(/<script>/g)?.length, 1);
  assert.doesNotMatch(html, /<script src|\.\/glass\.png/);
});
