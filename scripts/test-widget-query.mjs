import fs from "node:fs";
import path from "node:path";

/**
 * End-to-end smoke test for the Polaris widget query.
 *
 * Reads .env, then runs the exact same SQL the dashboard runs against
 * Polaris, for one or more widget IDs and a date range. Prints what
 * came back so you can confirm the wiring before opening the UI.
 *
 * Usage (from qa-player-dashboard/):
 *   node scripts/test-widget-query.mjs <widgetId> [widgetId ...] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *
 * Defaults to today's date if --from/--to are omitted.
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
const TABLE = env.POLARIS_TABLE;

if (!BASE_URL || !TOKEN || !PROJECT_ID || !TABLE) {
  console.error(
    "Missing one of POLARIS_BASE_URL / POLARIS_API_TOKEN / POLARIS_PROJECT_ID / POLARIS_TABLE in .env"
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const widgetIds = [];
let from;
let to;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--from") {
    from = args[++i];
  } else if (args[i] === "--to") {
    to = args[++i];
  } else {
    widgetIds.push(args[i]);
  }
}

if (widgetIds.length === 0) {
  console.error("Usage: node scripts/test-widget-query.mjs <widgetId> [...]" +
    " [--from YYYY-MM-DD] [--to YYYY-MM-DD]");
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
    "widget_id" AS "widgetId",
    "version" AS "version",
    SUM("server_calls") AS "serverCalls",
    SUM("revenue") AS "revenue",
    CASE
      WHEN SUM("server_calls") > 0
      THEN SUM("revenue") / SUM("server_calls") * 1000
      ELSE 0
    END AS "revenueEcpm"
  FROM "${TABLE.replace(/"/g, '""')}"
  WHERE "widget_id" IN (${placeholders})
    AND __time >= TIMESTAMP '${startDate} 00:00:00'
    AND __time <  TIMESTAMP '${endExclusive} 00:00:00'
  GROUP BY "widget_id", "version"
`;

const auth = "Basic " + Buffer.from(`${TOKEN}:`).toString("base64");

console.log(`Querying Polaris for widgets [${widgetIds.join(", ")}]`);
console.log(`Date range: ${startDate} .. ${endDate} (inclusive)`);
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

try {
  const rows = JSON.parse(text);
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log("No rows returned.");
  } else {
    console.table(rows);
  }
} catch {
  console.log(text.slice(0, 1000));
}
