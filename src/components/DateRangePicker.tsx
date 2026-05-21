"use client";

import type { DateRange } from "@/types/dashboard";

type Props = {
  value: DateRange;
  onChange: (next: DateRange) => void;
  onRefresh: () => void;
  refreshLabel?: string;
  refreshing?: boolean;
  disabled?: boolean;
};

export function DateRangePicker({
  value,
  onChange,
  onRefresh,
  refreshLabel = "Fetch Polaris Data",
  refreshing = false,
  disabled = false
}: Props) {
  return (
    <div className="date-range">
      <label>
        Start date
        <input
          type="date"
          value={value.startDate}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, startDate: e.target.value })}
        />
      </label>
      <label>
        End date
        <input
          type="date"
          value={value.endDate}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, endDate: e.target.value })}
        />
      </label>
      <button
        type="button"
        className="primary"
        onClick={onRefresh}
        disabled={disabled || refreshing}
      >
        {refreshing ? "Loading…" : refreshLabel}
      </button>
    </div>
  );
}
