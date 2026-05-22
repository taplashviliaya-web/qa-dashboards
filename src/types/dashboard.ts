export type SplitStatus = "valid" | "invalid" | "missing_data";

export type ApprovalStatus =
  | "approved"
  | "not_approved"
  | "needs_review"
  | "invalid_split"
  | "missing_data";

export type StatusColor = "green" | "red" | "orange" | "gray";

export type WidgetEvaluationInput = {
  widgetId: string;
  widgetName: string;
  aVersion: string;
  bVersion: string;
  aServerCalls: number;
  bServerCalls: number;
  aRevenueEcpm: number;
  bRevenueEcpm: number;
  aRevenue: number;
  bRevenue: number;
};

export type WidgetEvaluation = {
  splitStatus: SplitStatus;
  approvalStatus: ApprovalStatus;
  color: StatusColor;
  comment: string;
};

export type WidgetReportRow = {
  widgetId: string;
  widgetName: string;
  aVersion: string;
  bVersion: string;
  aServerCalls: number;
  bServerCalls: number;
  aTrafficPercent: number;
  bTrafficPercent: number;
  aRevenueEcpm: number;
  bRevenueEcpm: number;
  aRevenue: number;
  bRevenue: number;
  splitStatus: SplitStatus | string;
  approvalStatus: ApprovalStatus | string;
  color: StatusColor | string;
  comment: string;
  // Top video / page URL this widget is running on, picked from the Polaris
  // `urls` table for the same date range. `null` when no URL data is found
  // for the widget (no events in that window, or Polaris unavailable).
  topPageUrl: string | null;
};

export type WidgetReportResponse = {
  results: WidgetReportRow[];
};

export type DateRange = {
  startDate: string;
  endDate: string;
};
