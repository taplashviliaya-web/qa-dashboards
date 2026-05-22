"use client";

import type { WidgetReportRow } from "@/types/dashboard";
import { StatusBadge } from "./StatusBadge";

type Props = {
  rows: WidgetReportRow[];
};

const APPROVAL_META: Record<string, { label: string; icon: string }> = {
  approved: { label: "Approved", icon: "✅" },
  not_approved: { label: "Not Approved", icon: "❌" },
  needs_review: { label: "Needs Review", icon: "⚠️" },
  invalid_split: { label: "Invalid Split", icon: "⚠️" },
  missing_data: { label: "Missing Data", icon: "—" }
};

const SPLIT_LABELS: Record<string, string> = {
  valid: "Valid",
  invalid: "Invalid",
  missing_data: "—"
};

const SUMMARY_ORDER: Array<keyof typeof APPROVAL_META> = [
  "approved",
  "needs_review",
  "invalid_split",
  "not_approved",
  "missing_data"
];

const SUMMARY_CLASS: Record<string, string> = {
  approved: "summary-green",
  needs_review: "summary-orange",
  invalid_split: "summary-orange",
  not_approved: "summary-red",
  missing_data: "summary-gray"
};

function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fmtPercent(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

/**
 * Render the URL as `domain/last-path-segment` so the table stays scannable.
 * The full URL is still available on hover (title) and in the link href.
 */
function shortUrlLabel(url: string): string {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    return last ? `${u.hostname}/…/${last}` : u.hostname;
  } catch {
    return url;
  }
}

/**
 * Format a B-vs-A delta as `+$0.39 (+19.4%)` / `−$0.09 (−13.2%)` / `—`,
 * with a class hinting at color. Returns "—" when either side is zero or
 * not finite (e.g. Missing Data rows), to avoid divide-by-zero and noisy
 * "+Infinity%" output.
 */
function formatDelta(
  a: number,
  b: number
): { label: string; className: string } {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) {
    return { label: "—", className: "delta-zero" };
  }
  const abs = b - a;
  const pct = (abs / a) * 100;
  if (Math.abs(abs) < 1e-9) {
    return { label: "0.00 (0.0%)", className: "delta-zero" };
  }
  const sign = abs > 0 ? "+" : "−";
  const absLabel = fmtMoney(Math.abs(abs));
  const pctLabel = `${Math.abs(pct).toFixed(1)}%`;
  return {
    label: `${sign}${absLabel} (${sign}${pctLabel})`,
    className: abs > 0 ? "delta-positive" : "delta-negative"
  };
}

function countByApproval(rows: WidgetReportRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    counts[r.approvalStatus] = (counts[r.approvalStatus] ?? 0) + 1;
  }
  return counts;
}

export function WidgetPerformanceTable({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="muted">No widget performance data to display.</p>;
  }

  const counts = countByApproval(rows);

  return (
    <>
      <div className="status-summary" role="status" aria-label="A/B test summary">
        <span className="status-summary-total">
          {rows.length} widget{rows.length === 1 ? "" : "s"}
        </span>
        {SUMMARY_ORDER.map((key) => {
          const count = counts[key];
          if (!count) return null;
          const meta = APPROVAL_META[key];
          return (
            <span
              key={key}
              className={`status-summary-item ${SUMMARY_CLASS[key]}`}
              title={meta.label}
            >
              <span aria-hidden="true">{meta.icon}</span>
              {count} {meta.label}
            </span>
          );
        })}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Widget ID</th>
              <th>Widget Name</th>
              <th>Top Page URL</th>
              <th>Approval</th>
              <th className="number">A Revenue eCPM</th>
              <th className="number">B Revenue eCPM</th>
              <th className="number">Δ eCPM (B − A)</th>
              <th>Comment</th>
              <th>A Version</th>
              <th>B Version</th>
              <th className="number">A Server Calls</th>
              <th className="number">B Server Calls</th>
              <th className="number">A Traffic %</th>
              <th className="number">B Traffic %</th>
              <th className="number">A Revenue</th>
              <th className="number">B Revenue</th>
              <th>Split</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const meta = APPROVAL_META[row.approvalStatus] ?? {
                label: String(row.approvalStatus),
                icon: ""
              };
              const splitLabel =
                SPLIT_LABELS[row.splitStatus] ?? String(row.splitStatus);
              const splitColor =
                row.splitStatus === "valid"
                  ? "green"
                  : row.splitStatus === "invalid"
                  ? "orange"
                  : "gray";
              const isMissing = row.approvalStatus === "missing_data";
              const ecpmDelta = isMissing
                ? { label: "—", className: "delta-zero" }
                : formatDelta(row.aRevenueEcpm, row.bRevenueEcpm);
              return (
                <tr key={row.widgetId} className={`row-status-${row.color}`}>
                  <td className="widget-id">{row.widgetId}</td>
                  <td>{row.widgetName}</td>
                  <td className="page-url-cell">
                    {row.topPageUrl ? (
                      <a
                        href={row.topPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={row.topPageUrl}
                      >
                        {shortUrlLabel(row.topPageUrl)}
                      </a>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge
                      color={row.color}
                      label={`${meta.icon} ${meta.label}`}
                    />
                  </td>
                  <td className="number ecpm-cell">{fmtMoney(row.aRevenueEcpm)}</td>
                  <td className="number ecpm-cell ecpm-b">
                    {row.bVersion ? fmtMoney(row.bRevenueEcpm) : "—"}
                  </td>
                  <td className={`number ${ecpmDelta.className}`}>
                    {ecpmDelta.label}
                  </td>
                  <td className="comment-cell">{row.comment}</td>
                  <td>{row.aVersion || "—"}</td>
                  <td>{row.bVersion || "—"}</td>
                  <td className="number">{fmtInt(row.aServerCalls)}</td>
                  <td className="number">{fmtInt(row.bServerCalls)}</td>
                  <td className="number">{fmtPercent(row.aTrafficPercent)}</td>
                  <td className="number">{fmtPercent(row.bTrafficPercent)}</td>
                  <td className="number">{fmtMoney(row.aRevenue)}</td>
                  <td className="number">{fmtMoney(row.bRevenue)}</td>
                  <td>
                    <StatusBadge color={splitColor} label={splitLabel} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
