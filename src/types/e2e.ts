/**
 * Types for the Console Dashboard's E2E (Playwright) integration.
 *
 * Data flow:
 *   GitHub Actions (truvidConsole/e2e.yml) -> CTRF JSON artifact -> our API ->
 *   normalized {@link E2eRunSummary} consumed by the Console page.
 *
 * We deliberately model only the fields the UI cares about — totals,
 * duration, failed-test names, and links to the original artifacts on
 * GitHub — so the schema stays stable even if the CTRF spec evolves.
 */

/** Result status for a single CTRF test entry. */
export type CtrfTestStatus =
  | "passed"
  | "failed"
  | "skipped"
  | "pending"
  | "other";

/**
 * Loose representation of a CTRF v1 report.
 *
 * The CTRF spec (https://ctrf.io/docs/schema/overview) defines many more
 * fields than this; we only declare what we actually read. Everything is
 * optional so a malformed / partial JSON doesn't blow up the parser.
 */
export type CtrfReport = {
  results?: {
    tool?: { name?: string; version?: string };
    summary?: {
      tests?: number;
      passed?: number;
      failed?: number;
      skipped?: number;
      pending?: number;
      other?: number;
      /** Unix ms */
      start?: number;
      /** Unix ms */
      stop?: number;
    };
    tests?: Array<{
      name?: string;
      status?: CtrfTestStatus;
      /** Milliseconds */
      duration?: number;
      suite?: string;
      message?: string;
      trace?: string;
      filepath?: string;
      retries?: number;
      flaky?: boolean;
      browser?: string;
    }>;
    environment?: Record<string, unknown>;
  };
};

/** Compact, UI-friendly view of a single failed test. */
export type E2eFailedTest = {
  name: string;
  suite?: string;
  durationMs: number;
  message?: string;
  filepath?: string;
  retries: number;
  flaky: boolean;
};

/** Where the raw run came from on GitHub, plus links the UI can show. */
export type E2eRunMeta = {
  /** GitHub workflow run id (number, stringified for safety in URLs). */
  runId: string;
  /** Human-readable run number, e.g. 247. */
  runNumber: number;
  /** Workflow display name, e.g. "E2E Tests". */
  workflowName: string;
  /** Branch the run executed against (head_branch). */
  branch: string;
  /** Short commit SHA the run was triggered for. */
  shortSha: string;
  /** Full SHA — useful for "view commit" links. */
  sha: string;
  /** Commit message (first line) for the SHA, if available. */
  commitMessage?: string;
  /** Who triggered the run (workflow_dispatch actor or commit author). */
  actor?: string;
  /** Avatar URL for the actor. */
  actorAvatarUrl?: string;
  /** ISO timestamp the run was created at. */
  createdAt: string;
  /** ISO timestamp the run finished at (`updated_at` on GH). */
  updatedAt: string;
  /** Run-level status: queued | in_progress | completed. */
  status: string;
  /** Run-level conclusion: success | failure | cancelled | ... */
  conclusion: string | null;
  /** URL to the run page on github.com. */
  htmlUrl: string;
};

/** One downloadable artifact attached to the run. */
export type E2eArtifact = {
  /** GitHub artifact id (stringified). */
  id: string;
  /** Artifact name, e.g. "playwright-report", "test-screenshots". */
  name: string;
  /** Size in bytes. */
  sizeInBytes: number;
  /** Expired artifacts can't be downloaded any more (>7 days for our setup). */
  expired: boolean;
  /** URL the dashboard links to (opens GH page or starts download). */
  htmlUrl: string;
};

/** Aggregated summary the UI renders in the Console "E2E" section. */
export type E2eRunSummary = {
  meta: E2eRunMeta;
  totals: {
    tests: number;
    passed: number;
    failed: number;
    skipped: number;
    pending: number;
    other: number;
    /** Total wall-clock duration of the run in ms (stop - start). */
    durationMs: number;
    /** Pass rate 0..1, derived from passed / (passed + failed). */
    passRate: number;
  };
  failedTests: E2eFailedTest[];
  /** Artifacts attached to the run that the UI surfaces as deep-dive links. */
  artifacts: {
    playwrightReport?: E2eArtifact;
    traces?: E2eArtifact;
    screenshots?: E2eArtifact;
    ctrfReport?: E2eArtifact;
  };
  /** Playwright tool name + version pulled from the CTRF report header. */
  tool?: {
    name?: string;
    version?: string;
  };
};

/**
 * Discriminated variants of the latest-run API response. The actual API
 * response is `E2eLatestRunResponseVariant & E2eLatestRunResponseCommon`
 * — shared fields live on the common side so every state can carry them.
 */
type E2eLatestRunResponseVariant =
  | {
      state: "ready";
      summary: E2eRunSummary;
      /** True when the response was served from in-memory/disk cache. */
      cached: boolean;
      /** True when this response was generated from mock data, not GitHub. */
      mock: boolean;
    }
  | {
      state: "not_configured";
      /** Which env vars are missing (helps the UI render a useful hint). */
      missingEnv: string[];
    }
  | {
      state: "no_runs";
      /** Friendly explanation, e.g. "No completed runs in the last 30 days." */
      message: string;
      /** Latest-known meta even if no usable CTRF artifact exists. */
      meta?: E2eRunMeta;
    }
  | {
      state: "no_ctrf_artifact";
      /** Run was found but the `ctrf-report` artifact is missing/expired. */
      message: string;
      meta: E2eRunMeta;
      /** Other artifacts that are present (so the UI can still link to them). */
      artifacts: E2eRunSummary["artifacts"];
    }
  | {
      state: "error";
      error: string;
    };

/** Fields included on every state of the response. */
export type E2eLatestRunResponseCommon = {
  /**
   * Link to the GitHub Actions UI for this workflow. Clicking opens the
   * workflow's runs page where users can click "Run workflow" to trigger
   * a new workflow_dispatch event. Lives on every response state so the
   * UI can always offer a "Run on GitHub" button.
   */
  workflowDispatchUrl: string;
};

/**
 * What `/api/e2e/latest-run` returns. The UI always gets a shape it can
 * render — even when the integration is misconfigured or no usable run
 * exists yet.
 */
export type E2eLatestRunResponse =
  E2eLatestRunResponseVariant & E2eLatestRunResponseCommon;
