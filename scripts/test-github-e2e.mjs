/**
 * Sanity check for the Console / E2E GitHub integration.
 *
 * Reads .env, then makes three read-only requests against the GitHub
 * REST API to confirm:
 *
 *   1. The PAT is valid and points at the expected user.
 *   2. The PAT can see the configured workflow file.
 *   3. The PAT can list the latest runs (and which artifacts they have).
 *
 * Usage:
 *   node scripts/test-github-e2e.mjs
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

const mask = (s) =>
  !s
    ? "<empty>"
    : s.length <= 12
      ? "****"
      : `${s.slice(0, 6)}...${s.slice(-4)} (len=${s.length})`;

const token = env.GITHUB_TOKEN;
const owner = env.E2E_REPO_OWNER;
const repo = env.E2E_REPO_NAME;
const workflow = env.E2E_WORKFLOW_FILE;
const branch = env.E2E_BRANCH || "development";

console.log("=== Config ===");
console.log("GITHUB_TOKEN      :", mask(token));
console.log("E2E_REPO_OWNER    :", owner);
console.log("E2E_REPO_NAME     :", repo);
console.log("E2E_WORKFLOW_FILE :", workflow);
console.log("E2E_BRANCH        :", branch);
console.log("");

if (!token || !owner || !repo || !workflow) {
  console.error(
    "❌ Missing required env vars. Set GITHUB_TOKEN / E2E_REPO_OWNER / " +
      "E2E_REPO_NAME / E2E_WORKFLOW_FILE in .env, then re-run."
  );
  process.exit(1);
}

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  Authorization: `Bearer ${token}`,
  "User-Agent": "qa-player-dashboard/scripts"
};

console.log("=== 1) GET /user (PAT identity) ===");
{
  const res = await fetch("https://api.github.com/user", { headers });
  console.log("status:", res.status, res.statusText);
  const body = await res.text();
  try {
    const j = JSON.parse(body);
    console.log("login:", j.login, "| id:", j.id);
  } catch {
    console.log("body :", body.slice(0, 400));
  }
}
console.log("");

console.log(`=== 2) GET workflows/${workflow} (workflow visibility) ===`);
{
  const url =
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/` +
    encodeURIComponent(workflow);
  const res = await fetch(url, { headers });
  console.log("status:", res.status, res.statusText);
  const body = await res.text();
  try {
    const j = JSON.parse(body);
    console.log("name :", j.name, "| state:", j.state, "| id:", j.id);
  } catch {
    console.log("body :", body.slice(0, 400));
  }
}
console.log("");

console.log(`=== 3) GET runs on ${branch} (latest 3) ===`);
{
  const url =
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/` +
    `${encodeURIComponent(workflow)}/runs?branch=${encodeURIComponent(branch)}` +
    `&per_page=3&exclude_pull_requests=true`;
  const res = await fetch(url, { headers });
  console.log("status:", res.status, res.statusText);
  const body = await res.text();
  try {
    const j = JSON.parse(body);
    const runs = j.workflow_runs ?? [];
    if (runs.length === 0) {
      console.log("⚠️  No runs on this branch yet — trigger one in the Actions tab.");
    }
    for (const r of runs) {
      console.log(
        `#${r.run_number}  ${r.status}/${r.conclusion ?? "—"}  ` +
          `${r.head_sha?.slice(0, 7)}  ${r.created_at}  →  ${r.html_url}`
      );
    }

    // Also peek at artifacts on the most recent run.
    if (runs[0]) {
      const artifactsUrl =
        `https://api.github.com/repos/${owner}/${repo}/actions/runs/` +
        `${runs[0].id}/artifacts?per_page=100`;
      const ares = await fetch(artifactsUrl, { headers });
      console.log("");
      console.log("--- Artifacts on most-recent run ---");
      console.log("status:", ares.status, ares.statusText);
      const adata = await ares.json();
      for (const a of adata.artifacts ?? []) {
        const flag = a.expired ? " (EXPIRED)" : "";
        console.log(
          `${a.name.padEnd(20)} ${String(a.size_in_bytes).padStart(10)} B${flag}`
        );
      }
      const names = (adata.artifacts ?? []).map((a) => a.name);
      const required = ["playwright-report", "ctrf-report"];
      const missing = required.filter((r) => !names.includes(r));
      if (missing.length > 0) {
        console.log(
          "\n⚠️  Missing required artifacts:",
          missing.join(", "),
          "— make sure the PR adding the ctrf-report upload step is merged " +
            "and a new workflow ran against this branch."
        );
      } else {
        console.log(
          "\n✅ All required artifacts present (playwright-report + ctrf-report)."
        );
      }
    }
  } catch {
    console.log("body :", body.slice(0, 400));
  }
}
