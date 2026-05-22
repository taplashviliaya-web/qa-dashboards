/**
 * GET /api/e2e/report/<runId>/<...path>
 *
 * Server-side proxy that serves the Playwright HTML report bundled in
 * the `playwright-report` artifact of workflow run `<runId>`. The first
 * request for a runId downloads + unzips the artifact under
 * `<os.tmpdir>/qa-player-dashboard/e2e-reports/<runId>/`; subsequent
 * requests (CSS, JS chunks, screenshots, etc.) hit the local cache
 * directly.
 *
 * The Console page embeds `<iframe src="/api/e2e/report/<runId>/" />`
 * and Playwright's report references all assets via relative URLs, so
 * the proxy needs to handle the index page + every sub-path under it.
 *
 * 404 (instead of 200 with empty content) on:
 *   - unconfigured integration,
 *   - unknown runId,
 *   - runId with no `playwright-report` artifact,
 *   - attempts to escape the cache dir.
 */

import fsp from "node:fs/promises";

import { NextResponse } from "next/server";

import type { GithubConfig } from "@/lib/githubClient";
import {
  listRunArtifacts,
  readGithubConfig
} from "@/lib/githubClient";
import { pickArtifactsByName } from "@/lib/parseCtrf";
import {
  contentTypeFor,
  ensureReportExtracted,
  resolveReportFile
} from "@/lib/artifactCache";

export const dynamic = "force-dynamic";

type Params = {
  params: {
    runId: string;
    path?: string[];
  };
};

export async function GET(_req: Request, ctx: Params) {
  const { runId, path } = ctx.params;
  if (!/^[0-9]+$/.test(runId)) {
    return new NextResponse("Bad runId", { status: 400 });
  }

  const cfg = readGithubConfig();
  if (!cfg) {
    return new NextResponse(
      "E2E report proxy is not configured (GITHUB_TOKEN / E2E_REPO_* missing).",
      { status: 503 }
    );
  }

  try {
    // 1. Ensure we have the report extracted on disk. If not yet,
    //    look up the playwright-report artifact for this runId and
    //    download it. ensureReportExtracted dedupes concurrent calls.
    const reportArtifactId = await resolvePlaywrightReportArtifactId(
      cfg,
      runId
    );
    if (!reportArtifactId) {
      return new NextResponse(
        `Run ${runId} has no playwright-report artifact (or it has expired).`,
        { status: 404 }
      );
    }
    await ensureReportExtracted(cfg, reportArtifactId, runId);

    // 2. Resolve the requested file (defaults to index.html for the
    //    iframe's root request).
    const filePath = resolveReportFile(runId, path ?? []);
    if (!filePath) {
      return new NextResponse("File not found in report.", { status: 404 });
    }

    // 3. Serve it.
    const body = await fsp.readFile(filePath);
    const filename = filePath.split(/[\\/]/).pop() ?? "index.html";
    // Convert Buffer to ArrayBuffer for the NextResponse constructor.
    const arrayBuffer = body.buffer.slice(
      body.byteOffset,
      body.byteOffset + body.byteLength
    ) as ArrayBuffer;
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(filename),
        // The proxied report's assets are immutable per runId — let the
        // browser cache them aggressively. The dashboard refreshes the
        // iframe `src` when the runId changes, so stale assets cannot
        // leak between runs.
        "Cache-Control": "private, max-age=300, immutable",
        // Allow this route to be loaded inside our own dashboard's
        // <iframe>. Equivalent to the deprecated `X-Frame-Options: SAMEORIGIN`.
        "Content-Security-Policy": "frame-ancestors 'self'"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(`E2E report proxy failed: ${message}`, {
      status: 500
    });
  }
}

/**
 * Look up the `playwright-report` artifact id for the run id.
 * Returns `undefined` if the run doesn't have one, or if it has expired.
 *
 * No caching here on purpose — the result is cheap (single REST call)
 * and the heavy lifting (download + unzip) is cached by
 * {@link ensureReportExtracted}.
 */
async function resolvePlaywrightReportArtifactId(
  cfg: GithubConfig,
  runId: string
): Promise<string | undefined> {
  const artifacts = await listRunArtifacts(cfg, runId);
  const named = pickArtifactsByName(artifacts);
  const report = named.playwrightReport;
  if (!report || report.expired) return undefined;
  return report.id;
}
