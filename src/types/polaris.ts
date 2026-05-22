export type PolarisWidgetRow = {
  widgetId: string;
  version: string;
  serverCalls: number;
  revenueEcpm: number;
  revenue: number;
};

export type PolarisWidgetQueryInput = {
  widgetIds: string[];
  startDate: string;
  endDate: string;
};

export type PolarisQueryResult = {
  rows: PolarisWidgetRow[];
};

/**
 * One (widget_id, page_url) aggregate row coming back from the Polaris
 * `urls` table. Used to surface the top page URL each widget is running on.
 */
export type PolarisWidgetUrlRow = {
  widgetId: string;
  pageUrl: string;
  eventCount: number;
};

export type PolarisWidgetUrlsResult = {
  rows: PolarisWidgetUrlRow[];
};
