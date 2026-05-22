/**
 * Smoke-test the *real* Jira queries used by the Player Dashboard:
 *
 *   1. Active Player Version Epics (matching the same JQL the app uses).
 *   2. For each Epic, the linked "is blocked by" tickets and the
 *      A/B Testing sub-task (if it exists).
 *
 * No Next.js boot required — this hits the Jira REST API directly using
 * the same auth scheme as src/lib/jiraClient.ts.
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]])
);

const BASE = env.JIRA_BASE_URL.replace(/\/$/, "");
const AUTH =
  "Basic " + Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString("base64");

async function jira(p) {
  const res = await fetch(`${BASE}${p}`, {
    headers: { Authorization: AUTH, Accept: "application/json" },
    cache: "no-store"
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
  }
  return JSON.parse(text);
}

const EPIC_JQL = [
  'summary ~ "Video Player Version Tests"',
  "type = Epic",
  "status NOT IN (Resolved, Rejected)"
].join(" AND ");

console.log("=== JQL ===");
console.log(EPIC_JQL);
console.log("");

console.log("=== Active Epics ===");
const search = await jira(
  `/rest/api/3/search/jql?jql=${encodeURIComponent(EPIC_JQL)}&fields=summary,status&maxResults=100`
);
const epics = search.issues ?? [];
console.log(`Found ${epics.length} epic(s).`);
for (const e of epics) {
  console.log(
    `  ${e.key.padEnd(12)} [${(e.fields.status?.name ?? "?").padEnd(14)}]  ${e.fields.summary ?? ""}`
  );
}
console.log("");

if (epics.length === 0) {
  console.log("No epics matched the JQL — nothing more to fetch. Stopping.");
  process.exit(0);
}

console.log("=== Details per Epic (linked tickets + subtasks) ===");
for (const e of epics) {
  console.log(`\n--- ${e.key} : ${e.fields.summary ?? ""} ---`);
  const detail = await jira(
    `/rest/api/3/issue/${encodeURIComponent(e.key)}?fields=summary,status,issuelinks,subtasks,issuetype`
  );

  const links = detail.fields.issuelinks ?? [];
  const isBlockedBy = links.filter(
    (l) => (l.type?.inward ?? "").toLowerCase() === "is blocked by" && l.inwardIssue
  );
  console.log(`  is-blocked-by links: ${isBlockedBy.length}`);
  for (const l of isBlockedBy) {
    const t = l.inwardIssue;
    console.log(
      `    - ${t.key.padEnd(12)} [${(t.fields?.status?.name ?? "?").padEnd(14)}]  ${
        t.fields?.summary ?? ""
      }`
    );
  }

  // A/B Testing is a child Task of the Epic (NOT a "Sub-task" issue type),
  // so it does NOT appear in fields.subtasks. We resolve it via JQL on
  // parent = <epicKey>.
  const abJql = `parent = "${e.key}" AND summary ~ "\\"A/B Testing\\""`;
  const abSearch = await jira(
    `/rest/api/3/search/jql?jql=${encodeURIComponent(abJql)}&fields=summary,status&maxResults=5`
  );
  const abIssues = abSearch.issues ?? [];
  const abExact = abIssues.find(
    (i) => (i.fields.summary ?? "").trim().toLowerCase() === "a/b testing"
  );
  const ab = abExact ?? abIssues[0];
  if (ab) {
    console.log(
      `  A/B Testing task: ${ab.key} [${ab.fields.status?.name ?? "?"}] — ${ab.fields.summary ?? ""}`
    );
  } else {
    console.log("  A/B Testing task: (none)");
  }
}
