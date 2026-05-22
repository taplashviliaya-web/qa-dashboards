import type { StatusColor } from "@/types/dashboard";

const COLOR_TO_CLASS: Record<string, string> = {
  green: "badge-green",
  red: "badge-red",
  orange: "badge-orange",
  gray: "badge-gray"
};

type Props = {
  color?: StatusColor | string;
  label: string;
  /** Render a leading colored dot inside the pill. Defaults to true. */
  withDot?: boolean;
};

export function StatusBadge({ color, label, withDot = true }: Props) {
  const cls = (color && COLOR_TO_CLASS[color]) ?? "badge-neutral";
  return (
    <span className={`badge ${cls}`}>
      {withDot ? <span className="badge-dot" aria-hidden /> : null}
      {label}
    </span>
  );
}

/** Map Jira status names to a sensible color. Falls back to neutral. */
export function jiraStatusColor(status: string | undefined): StatusColor | undefined {
  if (!status) return undefined;
  const s = status.toLowerCase();
  if (["done", "closed", "resolved", "approved"].includes(s)) return "green";
  if (["rejected", "blocked", "cancelled", "canceled"].includes(s)) return "red";
  if (["in review", "needs review", "in progress", "in qa", "testing"].some((x) => s.includes(x)))
    return "orange";
  return undefined;
}
