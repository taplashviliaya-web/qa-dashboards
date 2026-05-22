import fs from "node:fs";
import path from "node:path";

/**
 * Inspect a Polaris (Imply) table so we can wire up the real query in
 * src/lib/polarisClient.ts.
 *
 * What this prints:
 *   1. The column names + Druid types for POLARIS_TABLE.
 *   2. The min/max __time in the table (sanity check that data exists).
 *   3. One sample row, so you can see what real values look like.
 *
 * Usage (from qa-player-dashboard/):
 *   node scripts/inspect-polaris.mjs
 *
 * No secrets are printed — the API token is read from .env and only used
 * for the Authorization header.
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

// Imply Polaris API keys (pok_*) authenticate via HTTP Basic with the key
// as the username and an empty password.
const AUTH = "Basic " + Buffer.from(`${TOKEN}:`).toString("base64");
const SQL_URL = `${BASE_URL}/v1/projects/${PROJECT_ID}/queries/sql`;

async function runSql(query) {
  const res = await fetch(SQL_URL, {
    method: "POST",
    headers: {
      Authorization: AUTH,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ query, resultFormat: "object" })
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SQL ${res.status} ${res.statusText}\n${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function header(title) {
  console.log("\n=== " + title + " ===");
}

try {
  header(`Columns in "${TABLE}"`);
  const cols = await runSql(
    `SELECT COLUMN_NAME, DATA_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = '${TABLE}'
     ORDER BY ORDINAL_POSITION`
  );
  if (!Array.isArray(cols) || cols.length === 0) {
    console.log(
      `(no columns returned — double-check POLARIS_TABLE. Listing all tables instead...)`
    );
    const tables = await runSql(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = 'druid' ORDER BY TABLE_NAME`
    );
    console.log(tables);
  } else {
    for (const c of cols) {
      console.log(`  ${c.COLUMN_NAME.padEnd(32)} ${c.DATA_TYPE}`);
    }
  }

  header(`__time range in "${TABLE}"`);
  const range = await runSql(
    `SELECT MIN(__time) AS min_time, MAX(__time) AS max_time, COUNT(*) AS row_count
     FROM "${TABLE}"`
  );
  console.log(range);

  header(`Sample row from "${TABLE}"`);
  const sample = await runSql(`SELECT * FROM "${TABLE}" LIMIT 1`);
  console.log(JSON.stringify(sample, null, 2));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
