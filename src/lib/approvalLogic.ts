import type {
  WidgetEvaluation,
  WidgetEvaluationInput
} from "@/types/dashboard";

/** Allowed deviation from the 50/50 traffic split, in percentage points. */
export const SPLIT_TOLERANCE_PERCENT = 3;

/** Lower/upper bounds for a "valid" traffic share per side. */
export const SPLIT_MIN_PERCENT = 50 - SPLIT_TOLERANCE_PERCENT;
export const SPLIT_MAX_PERCENT = 50 + SPLIT_TOLERANCE_PERCENT;

/**
 * Evaluate a widget's A/B test result.
 *
 * Decision tree:
 *  1. If we don't have enough server-call data, return `missing_data`.
 *  2. Validate the 50/50 split (±3%). If invalid, return `invalid_split`
 *     (and, if B looks better, note that the decision can't be trusted).
 *  3. Compare Revenue eCPM:
 *     - B > A and B Revenue >= A Revenue -> `approved` (green)
 *     - B > A but B Revenue <  A Revenue -> `needs_review` (orange)
 *     - B <= A                            -> `not_approved` (red)
 */
export function evaluateWidgetPerformance(input: WidgetEvaluationInput): WidgetEvaluation {
  const {
    aServerCalls,
    bServerCalls,
    aRevenueEcpm,
    bRevenueEcpm,
    aRevenue,
    bRevenue
  } = input;

  const totalServerCalls = (aServerCalls ?? 0) + (bServerCalls ?? 0);

  if (!Number.isFinite(totalServerCalls) || totalServerCalls <= 0) {
    return {
      splitStatus: "missing_data",
      approvalStatus: "missing_data",
      color: "gray",
      comment: "No Polaris data found for this widget and selected date range."
    };
  }

  const aTrafficPercent = (aServerCalls / totalServerCalls) * 100;
  const bTrafficPercent = (bServerCalls / totalServerCalls) * 100;

  const splitValid =
    aTrafficPercent >= SPLIT_MIN_PERCENT &&
    aTrafficPercent <= SPLIT_MAX_PERCENT &&
    bTrafficPercent >= SPLIT_MIN_PERCENT &&
    bTrafficPercent <= SPLIT_MAX_PERCENT;

  if (!splitValid) {
    const bLooksBetter = bRevenueEcpm > aRevenueEcpm;
    return {
      splitStatus: "invalid",
      approvalStatus: "invalid_split",
      color: "orange",
      comment: bLooksBetter
        ? "B performs better, but traffic split is invalid. Performance decision cannot be trusted."
        : "Server calls are not divided 50/50 within the allowed 3% tolerance."
    };
  }

  if (bRevenueEcpm > aRevenueEcpm) {
    if (bRevenue < aRevenue) {
      return {
        splitStatus: "valid",
        approvalStatus: "needs_review",
        color: "orange",
        comment: "B Revenue eCPM is higher, but Revenue is lower. Must be reviewed."
      };
    }
    return {
      splitStatus: "valid",
      approvalStatus: "approved",
      color: "green",
      comment: "B Revenue eCPM is higher than A. Approved."
    };
  }

  return {
    splitStatus: "valid",
    approvalStatus: "not_approved",
    color: "red",
    comment: "B Revenue eCPM is not higher than A. Not approved."
  };
}
