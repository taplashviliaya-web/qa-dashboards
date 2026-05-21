import type { ParsedWidget } from "@/types/jira";

/**
 * Parse Widget IDs and Widget Names from the A/B Testing sub-task description.
 *
 * Accepts lines like:
 *   13837 - birgun.net_Instream
 *   13837 – birgun.net_Instream   (en dash)
 *   13837: birgun.net_Instream
 *   13837 | birgun.net_Instream
 *
 * Only numeric Widget IDs are considered valid. Other text on the line or
 * surrounding lines is ignored. Duplicates (by widgetId) are removed,
 * keeping the first occurrence.
 */
export function parseWidgets(description: string | null | undefined): ParsedWidget[] {
  if (!description || typeof description !== "string") return [];

  // Supported separators: hyphen-minus, en dash, em dash, colon, pipe.
  // Allow leading bullet/whitespace and optional space around the separator.
  const lineRegex = /^\s*(?:[-*•]\s*)?(\d+)\s*[-\u2013\u2014:|]\s*(.+?)\s*$/;

  const seen = new Set<string>();
  const widgets: ParsedWidget[] = [];

  for (const rawLine of description.split(/\r?\n/)) {
    const match = rawLine.match(lineRegex);
    if (!match) continue;

    const widgetId = match[1];
    const widgetName = match[2].trim();
    if (!widgetId || !widgetName) continue;
    if (seen.has(widgetId)) continue;

    seen.add(widgetId);
    widgets.push({ widgetId, widgetName });
  }

  return widgets;
}
