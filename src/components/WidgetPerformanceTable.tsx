"use client";

import type { WidgetReportRow } from "@/types/dashboard";
import { StatusBadge } from "./StatusBadge";

type Props = {
  rows: WidgetReportRow[];
};

const APPROVAL_LABELS: Record<string, string> = {
  approved: "Approved",
  not_approved: "Not Approved",
  needs_review: "Needs Review",
  invalid_split: "Invalid Split",
  missing_data: "Missing Data"
};

const SPLIT_LABELS: Record<string, string> = {
  valid: "Valid",
  invalid: "Invalid",
  missing_data: "—"
};

function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPercent(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

export function WidgetPerformanceTable({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="muted">No widget performance data to display.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Widget ID</th>
            <th>Widget Name</th>
            <th>A Version</th>
            <th>B Version</th>
            <th className="number">A Server Calls</th>
            <th className="number">B Server Calls</th>
            <th className="number">A Traffic %</th>
            <th className="number">B Traffic %</th>
            <th className="number">A Revenue eCPM</th>
            <th className="number">B Revenue eCPM</th>
            <th className="number">A Revenue</th>
            <th className="number">B Revenue</th>
            <th>Split</th>
            <th>Approval</th>
            <th>Comment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const approvalLabel =
              APPROVAL_LABELS[row.approvalStatus] ?? String(row.approvalStatus);
            const splitLabel = SPLIT_LABELS[row.splitStatus] ?? String(row.splitStatus);
            const splitColor =
              row.splitStatus === "valid"
                ? "green"
                : row.splitStatus === "invalid"
                ? "orange"
                : "gray";
            return (
              <tr key={row.widgetId}>
                <td>{row.widgetId}</td>
                <td>{row.widgetName}</td>
                <td>{row.aVersion || "—"}</td>
                <td>{row.bVersion || "—"}</td>
                <td className="number">{fmtInt(row.aServerCalls)}</td>
                <td className="number">{fmtInt(row.bServerCalls)}</td>
                <td className="number">{fmtPercent(row.aTrafficPercent)}</td>
                <td className="number">{fmtPercent(row.bTrafficPercent)}</td>
                <td className="number">{fmtMoney(row.aRevenueEcpm)}</td>
                <td className="number">{fmtMoney(row.bRevenueEcpm)}</td>
                <td className="number">{fmtMoney(row.aRevenue)}</td>
                <td className="number">{fmtMoney(row.bRevenue)}</td>
                <td>
                  <StatusBadge color={splitColor} label={splitLabel} />
                </td>
                <td>
                  <StatusBadge color={row.color} label={approvalLabel} />
                </td>
                <td className="muted">{row.comment}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
