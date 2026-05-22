/**
 * GitHub REST API client — read-only, used by the Console Dashboard to
 * fetch the latest E2E workflow run + its artifacts from the
 * `branovate-ltd/truvidConsole` repository.
 *
 * Auth: fine-grained PAT in `GITHUB_TOKEN` with read-only access to
 * **Actions** and **Contents** on the target repo. The token is read
 * server-side only — these helpers must never be imported into a client
 * component.
 *
 * Required env:
 *   GITHUB_TOKEN          ghp_*** or github_pat_***
 *   E2E_REPO_OWNER        e.g. "branovate-ltd"
 *   E2E_REPO_NAME         e.g. "truvidConsole"
 *   E2E_WORKFLOW_FILE     e.g. "e2e.yml" (filename inside .github/workflows)
 *   E2E_BRANCH            optional, defaults to "development"
 *
 * If any are missing, `readGithubConfig()` returns `undefined` and callers
 * can degrade gracefully ("not configured" state).
 */

import type { E2eArtifact, E2eRunMeta } from "@/types/e2e";

/** Env-driven config; undefined when the integration isn't wired up. */
export type GithubConfig = {
  token: string;
  owner: string;
  repo: string;
  workflowFile: string;
  branch: string;
};

/** Shape of a workflow run object (only the fields we read). */
type GhWorkflowRun = {
  id: number;
  name?: string;
  run_number: number;
  head_branch: string;
  head_sha: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  head_commit?: {
    message?: string;
  } | null;
  actor?: {
    login?: string;
    avatar_url?: string;
  };
  triggering_actor?: {
    login?: string;
    avatar_url?: string;
  };
};

type GhWorkflowRunsResponse = {
  total_count: number;
  workflow_runs: GhWorkflowRun[];
};

type GhArtifact = {
  id: number;
  name: string;
  size_in_bytes: number;
  expired: boolean;
  url: string;
  archive_download_url: string;
};

type GhArtifactsResponse = {
  total_count: number;
  artifacts: GhArtifact[];
};

/**
 * Read GitHub config from env. Returns `undefined` if the integration
 * is unconfigured (so the UI can show a friendly "not configured"
 * panel without throwing).
 */
export function readGithubConfig(): GithubConfig | undefined {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.E2E_REPO_OWNER;
  const repo = process.env.E2E_REPO_NAME;
  const workflowFile = process.env.E2E_WORKFLOW_FILE;
  const branch = process.env.E2E_BRANCH || "development";

  if (!token || !owner || !repo || !workflowFile) return undefined;
  return { token, owner, repo, workflowFile, branch };
}

/** Returns which required env vars are missing (for the UI hint). */
export function missingGithubEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.GITHUB_TOKEN) missing.push("GITHUB_TOKEN");
  if (!process.env.E2E_REPO_OWNER) missing.push("E2E_REPO_OWNER");
  if (!process.env.E2E_REPO_NAME) missing.push("E2E_REPO_NAME");
  if (!process.env.E2E_WORKFLOW_FILE) missing.push("E2E_WORKFLOW_FILE");
  return missing;
}

/** Convenience for the UI banner / hub card. */
export function isGithubConfigured(): boolean {
  return readGithubConfig() !== undefined;
}

const GH_API = "https://api.github.com";
const GH_API_VERSION = "2022-11-28";

/**
 * Thin fetch wrapper that injects the auth header + standard Accept and
 * throws a clean Error with response body context on non-2xx responses.
 *
 * `cache: "no-store"` because workflow runs change frequently and the
 * dashboard already implements its own per-runId cache one layer up.
 */
async function ghFetch(
  cfg: GithubConfig,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${GH_API}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GH_API_VERSION,
      Authorization: `Bearer ${cfg.token}`,
      "User-Agent": "qa-player-dashboard",
      ...(init.headers ?? {})
    },
    cache: "no-store"
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `GitHub ${init.method ?? "GET"} ${path} failed: ${res.status} ${res.statusText}` +
        (body ? ` — ${body.slice(0, 500)}` : "")
    );
  }
  return res;
}

/**
 * Get the latest workflow run for the configured workflow file and
 * branch, *regardless of conclusion* (success / failure / cancelled).
 *
 * We deliberately don't filter by `status=completed` because we want
 * the most recent attempt — if it failed, the run still has a CTRF
 * report (CTRF uploads on `if: always()` per the workflow YAML).
 *
 * Returns `null` when no runs exist for that workflow+branch.
 */
export async function getLatestWorkflowRun(
  cfg: GithubConfig
): Promise<E2eRunMeta | null> {
  const params = new URLSearchParams({
    branch: cfg.branch,
    per_page: "1",
    // exclude_pull_requests reduces noise for push/dispatch-triggered runs.
    exclude_pull_requests: "true"
  });
  const path = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}` +
    `/actions/workflows/${encodeURIComponent(cfg.workflowFile)}/runs?${params.toString()}`;
  const res = await ghFetch(cfg, path);
  const data = (await res.json()) as GhWorkflowRunsResponse;
  const run = data.workflow_runs?.[0];
  if (!run) return null;
  return toRunMeta(run);
}

/**
 * Same as {@link getLatestWorkflowRun} but skips in-progress / queued
 * runs. Useful when we specifically want a run with completed artifacts.
 * Returns `null` if no completed run exists in the recent page.
 */
export async function getLatestCompletedWorkflowRun(
  cfg: GithubConfig
): Promise<E2eRunMeta | null> {
  const params = new URLSearchParams({
    branch: cfg.branch,
    per_page: "10",
    status: "completed",
    exclude_pull_requests: "true"
  });
  const path = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}` +
    `/actions/workflows/${encodeURIComponent(cfg.workflowFile)}/runs?${params.toString()}`;
  const res = await ghFetch(cfg, path);
  const data = (await res.json()) as GhWorkflowRunsResponse;
  const run = data.workflow_runs?.[0];
  if (!run) return null;
  return toRunMeta(run);
}

/** List all artifacts attached to a run, paginated up to 100 (plenty for us). */
export async function listRunArtifacts(
  cfg: GithubConfig,
  runId: string
): Promise<E2eArtifact[]> {
  const path = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}` +
    `/actions/runs/${encodeURIComponent(runId)}/artifacts?per_page=100`;
  const res = await ghFetch(cfg, path);
  const data = (await res.json()) as GhArtifactsResponse;
  return (data.artifacts ?? []).map((a) => toArtifact(cfg, runId, a));
}

/**
 * Download an artifact as a raw ZIP buffer.
 *
 * Note: GitHub returns a 302 to a short-lived presigned URL; `fetch`
 * follows that redirect automatically.
 *
 * Throws if the artifact has expired (>7 days for our retention).
 */
export async function downloadArtifactZip(
  cfg: GithubConfig,
  artifactId: string
): Promise<Buffer> {
  const path = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}` +
    `/actions/artifacts/${encodeURIComponent(artifactId)}/zip`;
  const res = await ghFetch(cfg, path);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function toRunMeta(run: GhWorkflowRun): E2eRunMeta {
  const actor = run.triggering_actor ?? run.actor;
  return {
    runId: String(run.id),
    runNumber: run.run_number,
    workflowName: run.name ?? "E2E Tests",
    branch: run.head_branch,
    shortSha: run.head_sha.slice(0, 7),
    sha: run.head_sha,
    commitMessage: run.head_commit?.message?.split("\n")[0] ?? undefined,
    actor: actor?.login,
    actorAvatarUrl: actor?.avatar_url,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    status: run.status,
    conclusion: run.conclusion,
    htmlUrl: run.html_url
  };
}

function toArtifact(
  cfg: GithubConfig,
  runId: string,
  a: GhArtifact
): E2eArtifact {
  // GitHub doesn't return an HTML link for an artifact directly; the
  // closest public URL is the run page's #artifacts anchor.
  const runUrl =
    `https://github.com/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}` +
    `/actions/runs/${encodeURIComponent(runId)}`;
  return {
    id: String(a.id),
    name: a.name,
    sizeInBytes: a.size_in_bytes,
    expired: a.expired,
    htmlUrl: `${runUrl}#artifacts`
  };
}
