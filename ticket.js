import { ticketKey } from "./bundle.js";

export async function searchTicket(key, gql, fields) {
  const ticket = ticketKey(key);
  if (!ticket) throw new Error("Invalid ticket key.");
  const exact = new RegExp(`\\b${ticket}\\b`, "i");
  const query = `query($q: String!, $after: String) {
    viewer { login avatarUrl(size: 40) }
    search(query: $q, type: ISSUE, first: 50, after: $after) {
      issueCount pageInfo { hasNextPage endCursor }
      nodes { ... on PullRequest { ${fields} repository { name owner { login } } } }
    }
  }`;
  const matches = new Map();
  let after = null, data;
  do {
    data = await gql(query, { q: `is:pr in:title "${ticket}"`, after }, true);
    for (const pr of data.search.nodes) {
      if (!pr?.id || !exact.test(pr.title)) continue;
      const ref = { owner: pr.repository.owner.login, repo: pr.repository.name, number: pr.number };
      matches.set(pr.id, { ref, pr });
    }
    after = data.search.pageInfo.hasNextPage ? data.search.pageInfo.endCursor : null;
  } while (after);
  return { viewer: data.viewer, pairs: [...matches.values()], truncated: data.search.issueCount > 1000 };
}
