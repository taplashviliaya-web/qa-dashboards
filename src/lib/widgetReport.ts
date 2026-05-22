import type { ParsedWidget } from "@/types/jira";
import type { PolarisWidgetRow, PolarisWidgetUrlRow } from "@/types/polaris";
import type { WidgetReportRow } from "@/types/dashboard";
import { evaluateWidgetPerformance } from "@/lib/approvalLogic";

/**
 * Reduce a flat list of (widgetId, pageUrl, eventCount) rows to a
 * `widgetId -> topPageUrl` map by picking the URL with the highest event
 * count per widget. The Polaris query already orders by eventCount DESC
 * within each widget, but we don't rely on that — we re-pick defensively.
 */
export function buildTopUrlByWidget(
  rows: PolarisWidgetUrlRow[]
): Record<string, string> {
  const best: Record<string, PolarisWidgetUrlRow> = {};
  for (const r of rows) {
    if (!r.pageUrl) continue;
    const current = best[r.widgetId];
    if (!current || r.eventCount > current.eventCount) {
      best[r.widgetId] = r;
    }
  }
  const out: Record<string, string> = {};
  for (const [widgetId, row] of Object.entries(best)) {
    out[widgetId] = row.pageUrl;
  }
  return out;
}

/**
 * From all Polaris rows for a given widget, pick the A (control) and B
 * (test) versions.
 *
 * Spec:
 *   - Treat the version containing `B` as the B/test version.
 *   - Treat the other matching version as the A/control version.
 *   - If both A and B cannot be detected, return undefined for the missing
 *     side; the caller is responsible for surfacing a clear message.
 *
 * We deliberately keep this loose: version names may change, so we only
 * rely on the convention that the test version contains an uppercase `B`
 * somewhere in its label (e.g. `6.61-rc3B`).
 */
export function pickAbVersions(rows: PolarisWidgetRow[]): {
  a?: PolarisWidgetRow;
  b?: PolarisWidgetRow;
} {
  const bCandidates = rows.filter((r) => /B/.test(r.version));
  const aCandidates = rows.filter((r) => !/B/.test(r.version));

  // If we have multiple candidates on either side, pick the one with the
  // most server calls — that's almost always the "real" A/B participant.
  const byServerCallsDesc = (x: PolarisWidgetRow, y: PolarisWidgetRow) =>
    y.serverCalls - x.serverCalls;

  return {
    a: aCandidates.sort(byServerCallsDesc)[0],
    b: bCandidates.sort(byServerCallsDesc)[0]
  };
}

const MISSING_VERSIONS_COMMENT = "Could not find both A and B versions in Polaris data.";
const NO_DATA_COMMENT = "No Polaris data found for this widget and selected date range.";

/**
 * Build a single widget report row from the Polaris rows for that widget.
 * Handles all the "missing data" branches up-front so `evaluateWidgetPerformance`
 * only runs against real, complete data.
 *
 * `topPageUrl` is purely informational and never affects the approval
 * verdict — it just lets the UI link straight to a page the widget runs on.
 */
export function buildWidgetReportRow(
  widget: ParsedWidget,
  rows: PolarisWidgetRow[],
  topPageUrl: string | null = null
): WidgetReportRow {
  if (rows.length === 0) {
    return missingDataRow(widget, NO_DATA_COMMENT, { topPageUrl });
  }

  const { a, b } = pickAbVersions(rows);

  if (!a || !b) {
    return missingDataRow(widget, MISSING_VERSIONS_COMMENT, {
      aVersion: a?.version ?? "",
      bVersion: b?.version ?? "",
      aServerCalls: a?.serverCalls ?? 0,
      bServerCalls: b?.serverCalls ?? 0,
      aRevenueEcpm: a?.revenueEcpm ?? 0,
      bRevenueEcpm: b?.revenueEcpm ?? 0,
      aRevenue: a?.revenue ?? 0,
      bRevenue: b?.revenue ?? 0,
      topPageUrl
    });
  }

  const evaluation = evaluateWidgetPerformance({
    widgetId: widget.widgetId,
    widgetName: widget.widgetName,
    aVersion: a.version,
    bVersion: b.version,
    aServerCalls: a.serverCalls,
    bServerCalls: b.serverCalls,
    aRevenueEcpm: a.revenueEcpm,
    bRevenueEcpm: b.revenueEcpm,
    aRevenue: a.revenue,
    bRevenue: b.revenue
  });

  const total = a.serverCalls + b.serverCalls;
  const aTrafficPercent = total > 0 ? (a.serverCalls / total) * 100 : 0;
  const bTrafficPercent = total > 0 ? (b.serverCalls / total) * 100 : 0;

  return {
    widgetId: widget.widgetId,
    widgetName: widget.widgetName,
    aVersion: a.version,
    bVersion: b.version,
    aServerCalls: a.serverCalls,
    bServerCalls: b.serverCalls,
    aTrafficPercent,
    bTrafficPercent,
    aRevenueEcpm: a.revenueEcpm,
    bRevenueEcpm: b.revenueEcpm,
    aRevenue: a.revenue,
    bRevenue: b.revenue,
    splitStatus: evaluation.splitStatus,
    approvalStatus: evaluation.approvalStatus,
    color: evaluation.color,
    comment: evaluation.comment,
    topPageUrl
  };
}

function missingDataRow(
  widget: ParsedWidget,
  comment: string,
  partial: Partial<WidgetReportRow> = {}
): WidgetReportRow {
  return {
    widgetId: widget.widgetId,
    widgetName: widget.widgetName,
    aVersion: "",
    bVersion: "",
    aServerCalls: 0,
    bServerCalls: 0,
    aTrafficPercent: 0,
    bTrafficPercent: 0,
    aRevenueEcpm: 0,
    bRevenueEcpm: 0,
    aRevenue: 0,
    bRevenue: 0,
    topPageUrl: null,
    ...partial,
    splitStatus: "missing_data",
    approvalStatus: "missing_data",
    color: "gray",
    comment
  };
}
