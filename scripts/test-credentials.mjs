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

const mask = (s) =>
  !s ? "<empty>" : s.length <= 12 ? "****" : `${s.slice(0, 6)}...${s.slice(-4)} (len=${s.length})`;

console.log("=== Config ===");
console.log("JIRA_BASE_URL    :", env.JIRA_BASE_URL);
console.log("JIRA_EMAIL       :", env.JIRA_EMAIL);
console.log("JIRA_API_TOKEN   :", mask(env.JIRA_API_TOKEN));
console.log("POLARIS_BASE_URL :", env.POLARIS_BASE_URL);
console.log("POLARIS_API_TOKEN:", mask(env.POLARIS_API_TOKEN));
console.log("");

console.log("=== Jira: GET /rest/api/3/myself ===");
{
  const auth = Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString("base64");
  const res = await fetch(`${env.JIRA_BASE_URL}/rest/api/3/myself`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" }
  });
  console.log("status:", res.status, res.statusText);
  console.log("body  :", (await res.text()).slice(0, 400));
}
console.log("");

console.log("=== Polaris: GET /v1/projects ===");
{
  // Imply Polaris API keys (pok_*) use HTTP Basic auth with the key
  // as the username and an empty password.
  const auth = Buffer.from(`${env.POLARIS_API_TOKEN}:`).toString("base64");
  const res = await fetch(`${env.POLARIS_BASE_URL}/v1/projects`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" }
  });
  console.log("status:", res.status, res.statusText);
  console.log("body  :", (await res.text()).slice(0, 400));
}
