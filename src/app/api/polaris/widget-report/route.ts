import { NextResponse } from "next/server";
import type { ParsedWidget } from "@/types/jira";
import type { WidgetReportResponse } from "@/types/dashboard";
import { normalizeDateRange } from "@/lib/dateRange";
import { getWidgetReport } from "@/lib/polarisClient";
import { buildWidgetReportRow } from "@/lib/widgetReport";
import { getMockPolarisRows, isMockMode } from "@/lib/mockData";

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
    const rows = isMockMode()
      ? getMockPolarisRows(widgetIds)
      : (await getWidgetReport({ widgetIds, startDate, endDate })).rows;

    const results = widgets.map((widget) => {
      const widgetRows = rows.filter((r) => r.widgetId === widget.widgetId);
      return buildWidgetReportRow(widget, widgetRows);
    });

    return NextResponse.json<WidgetReportResponse>({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
