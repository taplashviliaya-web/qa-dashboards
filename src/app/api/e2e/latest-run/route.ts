/**
 * GET /api/e2e/latest-run
 *
 * Returns the Console Dashboard's "latest E2E run" payload. The route
 * is the single integration point the UI talks to — it owns the entire
 * "go fetch the run + parse CTRF + decide whether things are healthy"
 * flow so the page can stay declarative.
 *
 * Always returns 200 with a typed `E2eLatestRunResponse` discriminated
 * by `state`:
 *
 *   - "ready"           : Full summary ready to render.
 *   - "not_configured"  : GitHub env vars are missing.
 *   - "no_runs"         : Branch has no workflow runs yet.
 *   - "no_ctrf_artifact": Run exists but `ctrf-report` is missing/expired.
 *   - "error"           : Anything else went wrong; UI shows error banner.
 */

import { NextResponse } from "next/server";

import type { E2eLatestRunResponse } from "@/types/e2e";
import {
  getLatestWorkflowRun,
  listRunArtifacts,
  missingGithubEnv,
  readGithubConfig
} from "@/lib/githubClient";
import {
  buildE2eRunSummary,
  pickArtifactsByName
} from "@/lib/parseCtrf";
import { readCtrfReportFromArtifact } from "@/lib/artifactCache";
import { getMockE2eRunSummary, isE2eMockMode } from "@/lib/mockData";

export const dynamic = "force-dynamic";

/**
 * Small in-memory cache so a refresh button mash doesn't hammer the GH
 * API. Keyed by the run id; cleared when a *newer* run is observed.
 *
 * The HTML report itself is cached separately on disk by
 * `artifactCache.ts` (per-runId folder under os.tmpdir()).
 */
type CacheEntry = {
  runId: string;
  payload: Extract<E2eLatestRunResponse, { state: "ready" }>;
  createdAtMs: number;
};
let SUMMARY_CACHE: CacheEntry | undefined;
const CACHE_TTL_MS = 60_000; // 60s — short enough to feel fresh, long enough to coalesce.

export async function GET(): Promise<NextResponse<E2eLatestRunResponse>> {
  if (isE2eMockMode()) {
    return NextResponse.json<E2eLatestRunResponse>({
      state: "ready",
      summary: getMockE2eRunSummary(),
      cached: false,
      mock: true
    });
  }

  const cfg = readGithubConfig();
  if (!cfg) {
    return NextResponse.json<E2eLatestRunResponse>({
      state: "not_configured",
      missingEnv: missingGithubEnv()
    });
  }

  try {
    const meta = await getLatestWorkflowRun(cfg);
    if (!meta) {
      return NextResponse.json<E2eLatestRunResponse>({
        state: "no_runs",
        message: `No workflow runs found for ${cfg.workflowFile} on ${cfg.branch}.`
      });
    }

    // Serve from cache when the most recent run matches and is fresh.
    if (
      SUMMARY_CACHE &&
      SUMMARY_CACHE.runId === meta.runId &&
      Date.now() - SUMMARY_CACHE.createdAtMs < CACHE_TTL_MS
    ) {
      return NextResponse.json<E2eLatestRunResponse>({
        ...SUMMARY_CACHE.payload,
        cached: true
      });
    }

    const artifacts = await listRunArtifacts(cfg, meta.runId);
    const namedArtifacts = pickArtifactsByName(artifacts);

    if (!namedArtifacts.ctrfReport || namedArtifacts.ctrfReport.expired) {
      // We have a run, but no usable CTRF artifact — usually means the
      // run pre-dates the `ctrf-report` upload step, OR it expired after
      // 7 days. Surface a tailored state so the UI can be helpful.
      const message = namedArtifacts.ctrfReport?.expired
        ? `Run #${meta.runNumber} exists but its ctrf-report artifact has expired (>7 days).`
        : `Run #${meta.runNumber} did not upload a ctrf-report artifact yet.`;
      return NextResponse.json<E2eLatestRunResponse>({
        state: "no_ctrf_artifact",
        message,
        meta,
        artifacts: namedArtifacts
      });
    }

    const ctrf = (await readCtrfReportFromArtifact(
      cfg,
      namedArtifacts.ctrfReport.id
    )) as Parameters<typeof buildE2eRunSummary>[0]["ctrf"] | undefined;

    if (!ctrf) {
      return NextResponse.json<E2eLatestRunResponse>({
        state: "no_ctrf_artifact",
        message:
          `Run #${meta.runNumber} uploaded a ctrf-report artifact but it ` +
          "didn't contain a parseable JSON file.",
        meta,
        artifacts: namedArtifacts
      });
    }

    const summary = buildE2eRunSummary({ ctrf, meta, artifacts });
    const payload: Extract<E2eLatestRunResponse, { state: "ready" }> = {
      state: "ready",
      summary,
      cached: false,
      mock: false
    };
    SUMMARY_CACHE = {
      runId: meta.runId,
      payload,
      createdAtMs: Date.now()
    };
    return NextResponse.json<E2eLatestRunResponse>(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json<E2eLatestRunResponse>({
      state: "error",
      error: message
    });
  }
}
