import fs from "node:fs";
import path from "node:path";

/**
 * Smoke test for the Polaris `urls` table query the dashboard runs to find
 * the top video / page URL for each widget.
 *
 * Reads .env, then runs the same SQL as `src/lib/polarisClient.ts ->
 * queryPolarisUrlsSql()` for one or more widget IDs and a date range.
 * Prints the per-widget URL leaderboard so you can confirm the wiring
 * before opening the UI.
 *
 * Usage (from qa-player-dashboard/):
 *   node scripts/test-widget-urls.mjs <widgetId> [widgetId ...] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--limit N]
 *
 * Defaults:
 *   - date range: today
 *   - limit:      10 URLs per widget
 */

const envPath = path.resolve(process.cwd(), ".env");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]])
);

const BASE_URL = (env.POLARIS_BASE_URL || "").replace(/\/$/, "");
const TOKEN = env.POLARIS_API_TOKEN;
const PROJECT_ID = env.POLARIS_PROJECT_ID;
const TABLE = env.POLARIS_URLS_TABLE || "urls";

if (!BASE_URL || !TOKEN || !PROJECT_ID) {
  console.error(
    "Missing one of POLARIS_BASE_URL / POLARIS_API_TOKEN / POLARIS_PROJECT_ID in .env"
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const widgetIds = [];
let from;
let to;
let limit = 10;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--from") {
    from = args[++i];
  } else if (args[i] === "--to") {
    to = args[++i];
  } else if (args[i] === "--limit") {
    limit = Number(args[++i]) || 10;
  } else {
    widgetIds.push(args[i]);
  }
}

if (widgetIds.length === 0) {
  console.error(
    "Usage: node scripts/test-widget-urls.mjs <widgetId> [...]" +
      " [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--limit N]"
  );
  process.exit(1);
}

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addOneDay(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 1);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

const startDate = from || today();
const endDate = to || today();
const endExclusive = addOneDay(endDate);

const placeholders = widgetIds.map(() => "?").join(", ");
const sql = `
  SELECT
    CAST("widget_id" AS VARCHAR) AS "widgetId",
    CAST("page_url" AS VARCHAR)  AS "pageUrl",
    COUNT(*) AS "eventCount"
  FROM "${TABLE.replace(/"/g, '""')}"
  WHERE CAST("widget_id" AS VARCHAR) IN (${placeholders})
    AND __time >= TIMESTAMP '${startDate} 00:00:00'
    AND __time <  TIMESTAMP '${endExclusive} 00:00:00'
  GROUP BY 1, 2
  ORDER BY 1, "eventCount" DESC
`;

const auth = "Basic " + Buffer.from(`${TOKEN}:`).toString("base64");

console.log(`Polaris urls table : ${TABLE}`);
console.log(`Widgets            : [${widgetIds.join(", ")}]`);
console.log(`Date range         : ${startDate} .. ${endDate} (inclusive)`);
console.log("");

const res = await fetch(`${BASE_URL}/v1/projects/${PROJECT_ID}/query/sql`, {
  method: "POST",
  headers: {
    Authorization: auth,
    "Content-Type": "application/json",
    Accept: "application/json"
  },
  body: JSON.stringify({
    query: sql,
    parameters: widgetIds.map((id) => ({ type: "VARCHAR", value: id })),
    resultFormat: "object"
  })
});

const text = await res.text();
console.log("status:", res.status, res.statusText);
if (!res.ok) {
  console.error(text.slice(0, 1000));
  process.exit(1);
}

let rows;
try {
  rows = JSON.parse(text);
} catch {
  console.log(text.slice(0, 1000));
  process.exit(1);
}

if (!Array.isArray(rows) || rows.length === 0) {
  console.log("No rows returned.");
  process.exit(0);
}

// Group by widget for a readable per-widget leaderboard.
const byWidget = new Map();
for (const r of rows) {
  const id = String(r.widgetId);
  if (!byWidget.has(id)) byWidget.set(id, []);
  byWidget.get(id).push(r);
}

for (const id of widgetIds) {
  const widgetRows = byWidget.get(id) || [];
  console.log("");
  console.log(`--- widget_id ${id} : ${widgetRows.length} distinct page_url(s) ---`);
  if (widgetRows.length === 0) {
    console.log("  (no events in this date range)");
    continue;
  }
  const top = widgetRows.slice(0, limit);
  for (const r of top) {
    console.log(`  ${String(r.eventCount).padStart(6)}  ${r.pageUrl}`);
  }
  console.log(`  -> picked top URL: ${widgetRows[0].pageUrl}`);
}
