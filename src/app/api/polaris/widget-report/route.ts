import { NextResponse } from "next/server";
import type { ParsedWidget } from "@/types/jira";
import type { WidgetReportResponse } from "@/types/dashboard";
import { normalizeDateRange } from "@/lib/dateRange";
import { getWidgetReport, getWidgetTopUrls } from "@/lib/polarisClient";
import { buildTopUrlByWidget, buildWidgetReportRow } from "@/lib/widgetReport";
import {
  getMockPolarisRows,
  getMockPolarisUrlRows,
  isMockMode
} from "@/lib/mockData";

export const dynamic = "force-dynamic";

type RequestBody = {
  widgets?: ParsedWidget[];
  startDate?: string;
  endDate?: string;
};

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const widgets = Array.isArray(body.widgets) ? body.widgets : [];
  if (widgets.length === 0) {
    return NextResponse.json<WidgetReportResponse>({ results: [] });
  }

  const { startDate, endDate } = normalizeDateRange({
    startDate: body.startDate,
    endDate: body.endDate
  });

  try {
    const widgetIds = widgets.map((w) => w.widgetId);

    // Fetch A/B analytics and (widget -> page_url) aggregates in parallel.
    // The URLs query is a "nice to have" — if it fails we still return the
    // approval rows without URLs rather than failing the whole response.
    const [analyticsResult, urlsResult] = await Promise.all([
      isMockMode()
        ? Promise.resolve({ rows: getMockPolarisRows(widgetIds) })
        : getWidgetReport({ widgetIds, startDate, endDate }),
      isMockMode()
        ? Promise.resolve({ rows: getMockPolarisUrlRows(widgetIds) })
        : getWidgetTopUrls({ widgetIds, startDate, endDate }).catch(() => ({
            rows: []
          }))
    ]);

    const rows = analyticsResult.rows;
    const topUrlByWidget = buildTopUrlByWidget(urlsResult.rows);

    const results = widgets.map((widget) => {
      const widgetRows = rows.filter((r) => r.widgetId === widget.widgetId);
      const topPageUrl = topUrlByWidget[widget.widgetId] ?? null;
      return buildWidgetReportRow(widget, widgetRows, topPageUrl);
    });

    return NextResponse.json<WidgetReportResponse>({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
