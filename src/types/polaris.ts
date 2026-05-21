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
