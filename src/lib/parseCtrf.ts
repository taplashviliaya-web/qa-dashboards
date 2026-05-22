/**
 * CTRF report -> normalized {@link E2eRunSummary} mapper.
 *
 * CTRF (Common Test Report Format) is a tool-agnostic JSON schema with
 * `results.summary` + `results.tests` at the top. We parse defensively
 * because:
 *
 *   - reporter versions evolve and may add/drop fields,
 *   - failing tests sometimes omit `duration`, and
 *   - the `summary.start`/`summary.stop` timestamps occasionally arrive
 *     as strings or seconds instead of ms.
 */

import type {
  CtrfReport,
  E2eArtifact,
  E2eFailedTest,
  E2eRunMeta,
  E2eRunSummary
} from "@/types/e2e";

/**
 * Build the normalized summary from a parsed CTRF document, the GitHub
 * run metadata and the list of artifacts attached to the run.
 */
export function buildE2eRunSummary(args: {
  ctrf: CtrfReport;
  meta: E2eRunMeta;
  artifacts: E2eArtifact[];
}): E2eRunSummary {
  const { ctrf, meta, artifacts } = args;
  const results = ctrf.results ?? {};
  const summary = results.summary ?? {};
  const tests = Array.isArray(results.tests) ? results.tests : [];

  const tool = results.tool
    ? { name: results.tool.name, version: results.tool.version }
    : undefined;

  // Prefer the summary-provided counts, but fall back to a recount from
  // `tests` if any of them is missing — that way a partial CTRF document
  // still surfaces useful numbers in the UI.
  const counts = recountFromTests(tests);
  const totalsTests = pickNumber(summary.tests, counts.tests);
  const totalsPassed = pickNumber(summary.passed, counts.passed);
  const totalsFailed = pickNumber(summary.failed, counts.failed);
  const totalsSkipped = pickNumber(summary.skipped, counts.skipped);
  const totalsPending = pickNumber(summary.pending, counts.pending);
  const totalsOther = pickNumber(summary.other, counts.other);

  const durationMs = computeDurationMs({
    start: summary.start,
    stop: summary.stop,
    tests
  });

  const passCount = totalsPassed;
  const failCount = totalsFailed;
  const passRateDenom = passCount + failCount;
  const passRate = passRateDenom > 0 ? passCount / passRateDenom : 0;

  const failedTests: E2eFailedTest[] = tests
    .filter((t) => t.status === "failed")
    .map((t) => ({
      name: stringOr(t.name, "(unnamed test)"),
      suite: typeof t.suite === "string" ? t.suite : undefined,
      durationMs: numberOr(t.duration, 0),
      message: trimMessage(t.message),
      filepath: typeof t.filepath === "string" ? t.filepath : undefined,
      retries: numberOr(t.retries, 0),
      flaky: Boolean(t.flaky)
    }));

  return {
    meta,
    totals: {
      tests: totalsTests,
      passed: totalsPassed,
      failed: totalsFailed,
      skipped: totalsSkipped,
      pending: totalsPending,
      other: totalsOther,
      durationMs,
      passRate
    },
    failedTests,
    artifacts: pickArtifactsByName(artifacts),
    tool
  };
}

/**
 * Map the artifact list (by name) to the slots the UI knows about. We
 * match on the artifact `name` strings that the truvidConsole workflow
 * uploads:
 *
 *   - "playwright-report" -> playwrightReport
 *   - "playwright-traces" -> traces
 *   - "test-screenshots"  -> screenshots
 *   - "ctrf-report"       -> ctrfReport
 *
 * Unknown artifacts are ignored.
 */
export function pickArtifactsByName(
  artifacts: E2eArtifact[]
): E2eRunSummary["artifacts"] {
  const out: E2eRunSummary["artifacts"] = {};
  for (const a of artifacts) {
    switch (a.name) {
      case "playwright-report":
        out.playwrightReport = a;
        break;
      case "playwright-traces":
        out.traces = a;
        break;
      case "test-screenshots":
        out.screenshots = a;
        break;
      case "ctrf-report":
        out.ctrfReport = a;
        break;
      default:
        break;
    }
  }
  return out;
}

/** Re-derive counts from the test array when summary is partial. */
function recountFromTests(
  tests: NonNullable<CtrfReport["results"]>["tests"] = []
): {
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
  other: number;
} {
  const out = {
    tests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
    other: 0
  };
  for (const t of tests ?? []) {
    out.tests += 1;
    switch (t.status) {
      case "passed":
        out.passed += 1;
        break;
      case "failed":
        out.failed += 1;
        break;
      case "skipped":
        out.skipped += 1;
        break;
      case "pending":
        out.pending += 1;
        break;
      default:
        out.other += 1;
        break;
    }
  }
  return out;
}

/**
 * Compute run duration in ms.
 *
 * Preference order:
 *   1. summary.stop - summary.start (both present and numeric).
 *   2. Sum of per-test durations (lower bound when summary is partial).
 *   3. 0 (nothing usable).
 */
function computeDurationMs(args: {
  start?: number;
  stop?: number;
  tests: NonNullable<CtrfReport["results"]>["tests"];
}): number {
  const start = toUnixMs(args.start);
  const stop = toUnixMs(args.stop);
  if (start !== undefined && stop !== undefined && stop >= start) {
    return stop - start;
  }
  let sum = 0;
  for (const t of args.tests ?? []) {
    sum += numberOr(t.duration, 0);
  }
  return sum;
}

/** Coerce a possibly-string / seconds-based timestamp to unix-ms. */
function toUnixMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Treat values <1e12 as seconds (any sane timestamp in ms is >1e12).
    return value < 1e12 ? Math.round(value * 1000) : value;
  }
  if (typeof value === "string") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return toUnixMs(asNumber);
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function pickNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function numberOr(value: unknown, fallback: number): number {
  return pickNumber(value, fallback);
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/**
 * Trim long Playwright error messages to a reasonable size for the table.
 * Keeps the first ~600 chars (the diff + first stack frame), drops the
 * rest.
 */
function trimMessage(message: unknown): string | undefined {
  if (typeof message !== "string" || message.length === 0) return undefined;
  const cleaned = message.replace(/\u001b\[[0-9;]*m/g, ""); // strip ANSI colors
  return cleaned.length > 600 ? cleaned.slice(0, 600) + " …" : cleaned;
}
