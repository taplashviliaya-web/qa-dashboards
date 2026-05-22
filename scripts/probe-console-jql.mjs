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

const auth = Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString(
  "base64"
);
const headers = {
  Authorization: `Basic ${auth}`,
  Accept: "application/json",
  "Content-Type": "application/json"
};

async function runJql(label, jql) {
  const params = new URLSearchParams({
    jql,
    fields: "summary,status,issuetype",
    maxResults: "10"
  });
  const url = `${env.JIRA_BASE_URL}/rest/api/3/search/jql?${params}`;
  const res = await fetch(url, { headers });
  console.log(`\n=== ${label} ===`);
  console.log("JQL    :", jql);
  console.log("status :", res.status, res.statusText);
  const text = await res.text();
  if (!res.ok) {
    console.log("error  :", text.slice(0, 400));
    return;
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    console.log("non-JSON:", text.slice(0, 200));
    return;
  }
  const issues = body.issues ?? [];
  console.log(`results: ${issues.length}`);
  for (const i of issues.slice(0, 10)) {
    console.log(
      `  - ${i.key.padEnd(14)} [${i.fields?.issuetype?.name ?? "?"}]`,
      `(${i.fields?.status?.name ?? "?"})`,
      i.fields?.summary ?? ""
    );
  }
}

const variants = [
  ['Player baseline (sanity)', 'summary ~ "Video Player Version Tests" AND type = Epic AND status NOT IN (Resolved, Rejected)'],
  ['Console exact (committed)', 'summary ~ "Video Console Version Tests" AND type = Epic AND status NOT IN (Resolved, Rejected)'],
  ['Console (no Video)', 'summary ~ "Console Version Tests" AND type = Epic AND status NOT IN (Resolved, Rejected)'],
  ['Console + Tests', 'summary ~ "Console" AND summary ~ "Tests" AND type = Epic AND status NOT IN (Resolved, Rejected)'],
  ['Just Console (broad)', 'summary ~ "Console" AND type = Epic AND status NOT IN (Resolved, Rejected)'],
  ['Console Dashboard label', 'labels = "Console Dashboard" AND type = Epic AND status NOT IN (Resolved, Rejected)'],
  ['Console label', 'labels = "Console" AND type = Epic AND status NOT IN (Resolved, Rejected)']
];

for (const [label, jql] of variants) {
  // eslint-disable-next-line no-await-in-loop
  await runJql(label, jql);
}
