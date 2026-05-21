import type { DateRange } from "@/types/dashboard";

/** Format a Date as `YYYY-MM-DD` in the local timezone. */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Return today's date as a `YYYY-MM-DD` string. */
export function today(): string {
  return formatDate(new Date());
}

/**
 * Default report date range. Today by default; can be overridden later via
 * `DEFAULT_REPORT_DATE_MODE` once we add more modes.
 */
export function defaultDateRange(): DateRange {
  const t = today();
  return { startDate: t, endDate: t };
}

/** Loose check that a value looks like `YYYY-MM-DD`. */
export function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Normalize a possibly-invalid input range to a safe range, defaulting to today. */
export function normalizeDateRange(input: Partial<DateRange> | undefined): DateRange {
  const fallback = defaultDateRange();
  const startDate = isValidDateString(input?.startDate) ? input!.startDate! : fallback.startDate;
  const endDate = isValidDateString(input?.endDate) ? input!.endDate! : fallback.endDate;
  if (startDate > endDate) {
    return { startDate: endDate, endDate: startDate };
  }
  return { startDate, endDate };
}
