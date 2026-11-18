import { test } from "node:test";
import assert from "node:assert/strict";
import { decode } from "./bundle.js";
import { hashFrom } from "./cli.mjs";
import { searchTicket } from "./ticket.js";

test("a CLI ticket opens the same live search as a shared ticket link", () => {
  const hash = hashFrom("cc-1234");
  assert.equal(hash, "#ticket=CC-1234");
  assert.equal(decode(hashFrom(`https://example.org/${hash}`)).ticket, "CC-1234");
  assert.equal(decode("#ticket=CC-1234+org:other").ticket, undefined);
});

test("ticket search follows cursors and returns only distinct exact title matches", async () => {
  const pr = (id, title) => ({ id, title, number: id, repository: { owner: { login: "acme" }, name: `repo${id}` } });
  const a = pr(1, "[CC-1234] api"), b = pr(2, "fix web (cc-1234)");
  const calls = [];
  const result = await searchTicket("CC-1234", async (_, vars) => {
    calls.push(vars);
    return { search: { nodes: vars.after ? [a, b] : [a, pr(3, "CC-12345"), pr(4, "ACC-1234")],
      pageInfo: { hasNextPage: !vars.after, endCursor: "next" }, issueCount: 4 } };
  }, "id title number");
  assert.deepEqual(calls, [null, "next"].map((after) => ({ after, q: 'is:pr in:title "CC-1234"' })));
  assert.deepEqual(result.pairs.map(({ ref }) => ref.repo), ["repo1", "repo2"]);
});
