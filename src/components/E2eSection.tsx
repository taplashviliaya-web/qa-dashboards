"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  E2eFailedTest,
  E2eLatestRunResponse,
  E2eRunSummary
} from "@/types/e2e";
import { StatusBadge } from "@/components/StatusBadge";

/**
 * Console Dashboard — "E2E Test Results" section.
 *
 * Loads the latest workflow run on mount via `/api/e2e/latest-run`,
 * renders the appropriate state-specific UI:
 *
 *   - "ready"            : run metadata + totals tiles + failed tests
 *                          table + artifact links + (toggleable) HTML
 *                          report iframe.
 *   - "not_configured"   : friendly hint listing missing env vars.
 *   - "no_runs"          : explains how to trigger a run.
 *   - "no_ctrf_artifact" : run found but ctrf-report missing/expired —
 *                          still surfaces any other artifacts.
 *   - "error"            : error banner with the raw message + Retry.
 *
 * The component is deliberately self-contained — it owns its data
 * loading so the Console page can drop it in beside the Jira section
 * without any wiring.
 */

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; payload: E2eLatestRunResponse };

export function E2eSection() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [showReport, setShowReport] = useState(false);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/e2e/latest-run", { cache: "no-store" });
      const body = (await res.json()) as E2eLatestRunResponse;
      setState({ status: "loaded", payload: body });
    } catch (err) {
      setState({
        status: "loaded",
        payload: {
          state: "error",
          error: err instanceof Error ? err.message : "Failed to fetch e2e run"
        }
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Hide the iframe when the run id changes so a stale report is never
  // shown for the new run id.
  const runIdForIframe =
    state.status === "loaded" &&
    state.payload.state === "ready" &&
    !state.payload.mock
      ? state.payload.summary.meta.runId
      : undefined;

  useEffect(() => {
    setShowReport(false);
  }, [runIdForIframe]);

  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="panel-header">
        <div>
          <h2>E2E Test Results</h2>
          <div className="muted" style={{ marginTop: 4 }}>
            Latest Playwright run from{" "}
            <code>branovate-ltd/truvidConsole</code> · workflow{" "}
            <code>e2e.yml</code>
          </div>
        </div>
        <div className="panel-actions">
          <button
            className="primary"
            onClick={() => void load()}
            disabled={state.status === "loading"}
          >
            {state.status === "loading" ? "Loading…" : "Refresh E2E"}
          </button>
        </div>
      </div>

      {state.status === "loading" ? (
        <p className="muted">Loading the latest E2E run from GitHub…</p>
      ) : (
        <E2eBody
          payload={state.payload}
          showReport={showReport}
          onToggleReport={() => setShowReport((v) => !v)}
        />
      )}
    </section>
  );
}

/* --------------------------------- Body --------------------------------- */

function E2eBody(props: {
  payload: E2eLatestRunResponse;
  showReport: boolean;
  onToggleReport: () => void;
}) {
  const { payload, showReport, onToggleReport } = props;

  if (payload.state === "not_configured") {
    return (
      <div className="info">
        <div>
          <b>GitHub integration is not configured.</b>{" "}
          <span className="muted">
            Add the following to your <code>.env</code> to enable E2E
            results:&nbsp;
            {payload.missingEnv.map((name, i) => (
              <span key={name}>
                {i > 0 ? ", " : ""}
                <code>{name}</code>
              </span>
            ))}
            .
          </span>
        </div>
      </div>
    );
  }

  if (payload.state === "no_runs") {
    return (
      <p className="muted">
        {payload.message} Trigger a run from the Actions tab in GitHub to
        populate this section.
      </p>
    );
  }

  if (payload.state === "error") {
    return <p className="error">Failed to load E2E run: {payload.error}</p>;
  }

  if (payload.state === "no_ctrf_artifact") {
    return (
      <div>
        <div className="info" style={{ marginBottom: 12 }}>
          <div>
            <b>{payload.message}</b>{" "}
            <span className="muted">
              Once the PR adding the <code>ctrf-report</code> upload step is
              merged and a fresh workflow runs against{" "}
              <code>{payload.meta.branch}</code>, the summary card will
              appear here automatically.
            </span>
          </div>
        </div>
        <RunMetaCard meta={payload.meta} />
        <ArtifactsRow artifacts={payload.artifacts} />
      </div>
    );
  }

  // ready
  return (
    <ReadyBody
      summary={payload.summary}
      mock={payload.mock}
      cached={payload.cached}
      showReport={showReport}
      onToggleReport={onToggleReport}
    />
  );
}

/* ------------------------------- Ready body ------------------------------ */

function ReadyBody(props: {
  summary: E2eRunSummary;
  mock: boolean;
  cached: boolean;
  showReport: boolean;
  onToggleReport: () => void;
}) {
  const { summary, mock, cached, showReport, onToggleReport } = props;
  const { meta, totals, failedTests, artifacts } = summary;
  const canEmbedReport = !mock && Boolean(artifacts.playwrightReport);

  return (
    <div>
      {mock ? (
        <div className="info" style={{ marginBottom: 12 }}>
          <div>
            <b>Mock mode is on for E2E.</b>{" "}
            <span className="muted">
              No <code>GITHUB_TOKEN</code> / <code>E2E_REPO_*</code> detected
              — showing a sample run so you can preview the UI. Once the PAT
              is added the section switches to live data automatically.
            </span>
          </div>
        </div>
      ) : null}

      <RunMetaCard meta={meta} cached={cached} />

      <TotalsGrid totals={totals} />

      <ArtifactsRow artifacts={artifacts} />

      {failedTests.length > 0 ? (
        <FailedTestsTable failedTests={failedTests} />
      ) : (
        <p className="muted" style={{ marginTop: 16 }}>
          🎉 No failed tests in this run.
        </p>
      )}

      {canEmbedReport ? (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8
            }}
          >
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
              Playwright HTML report
            </h3>
            <button onClick={onToggleReport}>
              {showReport ? "Hide embedded report" : "Show embedded report"}
            </button>
          </div>
          {showReport ? (
            <iframe
              key={meta.runId}
              title={`Playwright report for run #${meta.runNumber}`}
              src={`/api/e2e/report/${encodeURIComponent(meta.runId)}/index.html`}
              style={{
                width: "100%",
                height: 720,
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                background: "var(--panel)"
              }}
            />
          ) : (
            <p className="muted" style={{ marginTop: 0 }}>
              The full Playwright report (including per-test screenshots,
              videos and traces) renders inside the dashboard when you
              expand it — first load downloads + unzips the artifact, then
              every refresh is instant.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------- Sub-components ---------------------------- */

function RunMetaCard(props: {
  meta: E2eRunSummary["meta"];
  cached?: boolean;
}) {
  const { meta, cached } = props;
  const conclusion = meta.conclusion ?? meta.status;
  const conclusionColor = conclusionToColor(conclusion);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        marginBottom: 12
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <StatusBadge color={conclusionColor} label={conclusion} />
        <a
          href={meta.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontWeight: 600 }}
        >
          Run #{meta.runNumber}
        </a>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        <code>{meta.shortSha}</code> on{" "}
        <code>{meta.branch}</code>
        {meta.commitMessage ? ` — ${truncate(meta.commitMessage, 80)}` : ""}
      </div>
      <div className="muted" style={{ fontSize: 12, marginLeft: "auto" }}>
        {meta.actor ? <>by {meta.actor} · </> : null}
        {formatRelativeTime(meta.updatedAt)}
        {cached ? " · cached" : ""}
      </div>
    </div>
  );
}

function TotalsGrid(props: { totals: E2eRunSummary["totals"] }) {
  const { totals } = props;
  const passRatePct = Math.round(totals.passRate * 1000) / 10;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 10,
        marginBottom: 12
      }}
    >
      <Tile label="Total tests" value={totals.tests} />
      <Tile label="Passed" value={totals.passed} color="green" />
      <Tile label="Failed" value={totals.failed} color="red" />
      <Tile label="Skipped" value={totals.skipped} color="gray" />
      <Tile
        label="Pass rate"
        value={`${passRatePct.toFixed(1)}%`}
        color={tileColorForPassRate(passRatePct)}
      />
      <Tile label="Duration" value={formatDuration(totals.durationMs)} />
    </div>
  );
}

function Tile(props: {
  label: string;
  value: string | number;
  color?: "green" | "red" | "gray" | "orange" | "neutral";
}) {
  const { label, value, color } = props;
  const tone = colorToTone(color);
  return (
    <div
      style={{
        padding: "10px 12px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        background: tone.bg
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          color: "var(--text-subtle)"
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          marginTop: 2,
          color: tone.text
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ArtifactsRow(props: { artifacts: E2eRunSummary["artifacts"] }) {
  const { artifacts } = props;
  const entries: Array<{
    label: string;
    href: string;
    expired?: boolean;
    sizeBytes?: number;
  }> = [];
  if (artifacts.playwrightReport) {
    entries.push({
      label: "HTML report",
      href: artifacts.playwrightReport.htmlUrl,
      expired: artifacts.playwrightReport.expired,
      sizeBytes: artifacts.playwrightReport.sizeInBytes
    });
  }
  if (artifacts.traces) {
    entries.push({
      label: "Traces",
      href: artifacts.traces.htmlUrl,
      expired: artifacts.traces.expired,
      sizeBytes: artifacts.traces.sizeInBytes
    });
  }
  if (artifacts.screenshots) {
    entries.push({
      label: "Screenshots",
      href: artifacts.screenshots.htmlUrl,
      expired: artifacts.screenshots.expired,
      sizeBytes: artifacts.screenshots.sizeInBytes
    });
  }
  if (artifacts.ctrfReport) {
    entries.push({
      label: "CTRF JSON",
      href: artifacts.ctrfReport.htmlUrl,
      expired: artifacts.ctrfReport.expired,
      sizeBytes: artifacts.ctrfReport.sizeInBytes
    });
  }

  if (entries.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 12 }}>
        No artifacts attached to this run.
      </p>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 12,
        alignItems: "center"
      }}
    >
      <span
        className="muted"
        style={{ fontSize: 12, marginRight: 4 }}
      >
        Artifacts:
      </span>
      {entries.map((e) => (
        <a
          key={e.label}
          href={e.href}
          target="_blank"
          rel="noopener noreferrer"
          title={e.expired ? "Expired" : `${formatBytes(e.sizeBytes ?? 0)}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: "var(--radius-pill)",
            border: "1px solid var(--border)",
            background: "var(--panel)",
            fontSize: 12,
            color: e.expired ? "var(--text-subtle)" : "var(--link)",
            textDecoration: "none"
          }}
        >
          <span aria-hidden>📎</span>
          <span>{e.label}</span>
          {e.expired ? (
            <span className="muted" style={{ fontSize: 10 }}>
              (expired)
            </span>
          ) : (
            <span className="muted" style={{ fontSize: 10 }}>
              {formatBytes(e.sizeBytes ?? 0)}
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

function FailedTestsTable(props: { failedTests: E2eFailedTest[] }) {
  return (
    <div style={{ marginTop: 8 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: "8px 0" }}>
        Failed tests ({props.failedTests.length})
      </h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "40%" }}>Test</th>
              <th>Suite</th>
              <th>Duration</th>
              <th>Retries</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {props.failedTests.map((t, i) => (
              <tr key={`${t.name}-${i}`}>
                <td>
                  <div style={{ fontWeight: 500 }}>{t.name}</div>
                  {t.filepath ? (
                    <div className="muted" style={{ fontSize: 11 }}>
                      <code>{t.filepath}</code>
                    </div>
                  ) : null}
                </td>
                <td className="muted">{t.suite ?? "—"}</td>
                <td>{formatDuration(t.durationMs)}</td>
                <td>
                  {t.retries}
                  {t.flaky ? (
                    <>
                      {" "}
                      <span
                        className="badge badge-orange"
                        style={{ fontSize: 10 }}
                      >
                        flaky
                      </span>
                    </>
                  ) : null}
                </td>
                <td>
                  {t.message ? (
                    <pre
                      style={{
                        margin: 0,
                        maxWidth: 460,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontSize: 11,
                        color: "var(--text-muted)"
                      }}
                    >
                      {t.message}
                    </pre>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------- Utilities ------------------------------- */

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}m`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function conclusionToColor(
  conclusion: string
): "green" | "red" | "orange" | "gray" | undefined {
  switch (conclusion) {
    case "success":
      return "green";
    case "failure":
    case "timed_out":
    case "startup_failure":
      return "red";
    case "cancelled":
    case "neutral":
    case "stale":
      return "gray";
    case "action_required":
    case "in_progress":
    case "queued":
    case "waiting":
      return "orange";
    default:
      return undefined;
  }
}

function tileColorForPassRate(
  pct: number
): "green" | "orange" | "red" | undefined {
  if (pct >= 95) return "green";
  if (pct >= 80) return "orange";
  return "red";
}

function colorToTone(
  color?: "green" | "red" | "gray" | "orange" | "neutral"
): { bg: string; text: string } {
  switch (color) {
    case "green":
      return {
        bg: "var(--status-green-bg)",
        text: "var(--status-green-text)"
      };
    case "red":
      return {
        bg: "var(--status-red-bg)",
        text: "var(--status-red-text)"
      };
    case "orange":
      return {
        bg: "var(--status-orange-bg)",
        text: "var(--status-orange-text)"
      };
    case "gray":
      return {
        bg: "var(--status-gray-bg)",
        text: "var(--status-gray-text)"
      };
    case "neutral":
      return {
        bg: "var(--status-neutral-bg)",
        text: "var(--status-neutral-text)"
      };
    default:
      return { bg: "var(--panel)", text: "var(--text)" };
  }
}
