import type {
  PolarisQueryResult,
  PolarisWidgetQueryInput,
  PolarisWidgetRow
} from "@/types/polaris";

/**
 * Polaris (Imply) Analytics client.
 *
 * Talks to the Polaris synchronous SQL endpoint
 * (`POST /v1/projects/<id>/query/sql`) to aggregate Player A/B test
 * metrics per widget + version:
 *
 *   widgetId     <- widget_id
 *   version      <- version
 *   serverCalls  <- SUM(server_calls)
 *   revenue      <- SUM(revenue)
 *   revenueEcpm  <- SUM(revenue) / SUM(server_calls) * 1000
 *
 * Required env:
 *   POLARIS_BASE_URL    e.g. https://truvid.us-east-1.aws.api.imply.io
 *   POLARIS_API_TOKEN   Imply Polaris API key (pok_*)
 *   POLARIS_PROJECT_ID  Polaris project UUID
 *   POLARIS_TABLE       Druid table holding the player analytics events
 *
 * If any of these are missing the client returns an empty result set so
 * the UI can degrade gracefully to per-widget "missing data" messages.
 */

type PolarisConfig = {
  baseUrl: string;
  apiToken: string;
  projectId: string;
  table: string;
};

function readPolarisConfig(): PolarisConfig | undefined {
  const baseUrl = process.env.POLARIS_BASE_URL?.replace(/\/$/, "");
  const apiToken = process.env.POLARIS_API_TOKEN;
  const projectId = process.env.POLARIS_PROJECT_ID;
  const table = process.env.POLARIS_TABLE;
  if (!baseUrl || !apiToken || !projectId || !table) return undefined;
  return { baseUrl, apiToken, projectId, table };
}

/** Build the `Authorization: Basic ...` header value for a Polaris API key. */
function basicAuthHeader(apiToken: string): string {
  // Imply Polaris API keys (pok_*) authenticate via HTTP Basic with the key
  // as the username and an empty password.
  return "Basic " + Buffer.from(`${apiToken}:`).toString("base64");
}

/** YYYY-MM-DD + 1 day, returned as YYYY-MM-DD. Used for exclusive upper bound. */
function addOneDay(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 1);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Escape a SQL identifier (for the table name). */
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

async function queryPolarisSql(
  config: PolarisConfig,
  input: PolarisWidgetQueryInput
): Promise<PolarisWidgetRow[]> {
  if (input.widgetIds.length === 0) return [];

  // Polaris stores events keyed by `__time`. We want every event whose
  // local-day timestamp falls inside [startDate, endDate], so the upper
  // bound is exclusive at midnight of (endDate + 1).
  const startTs = `${input.startDate} 00:00:00`;
  const endTs = `${addOneDay(input.endDate)} 00:00:00`;

  const widgetPlaceholders = input.widgetIds.map(() => "?").join(", ");
  const table = quoteIdent(config.table);

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
    FROM ${table}
    WHERE "widget_id" IN (${widgetPlaceholders})
      AND __time >= TIMESTAMP '${startTs}'
      AND __time <  TIMESTAMP '${endTs}'
    GROUP BY "widget_id", "version"
  `;

  const parameters = input.widgetIds.map((id) => ({
    type: "VARCHAR",
    value: id
  }));

  const res = await fetch(
    `${config.baseUrl}/v1/projects/${config.projectId}/query/sql`,
    {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(config.apiToken),
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ query: sql, parameters, resultFormat: "object" })
    }
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Polaris SQL failed (${res.status} ${res.statusText}): ${text.slice(0, 500)}`
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Polaris SQL returned non-JSON response: ${text.slice(0, 200)}`);
  }

  return mapPolarisRows(json);
}

/** Coerce unknown numeric-like values into a finite number (or 0). */
function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Map Polaris SQL response rows into our normalized `PolarisWidgetRow`.
 * Accepts both camelCase aliases (what our SQL emits) and snake_case (in
 * case the query is changed later).
 */
export function mapPolarisRows(rawResponse: unknown): PolarisWidgetRow[] {
  if (!Array.isArray(rawResponse)) return [];
  const out: PolarisWidgetRow[] = [];
  for (const raw of rawResponse) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const widgetId = r.widgetId ?? r.widget_id;
    const version = r.version;
    if (
      (typeof widgetId !== "string" && typeof widgetId !== "number") ||
      typeof version !== "string"
    ) {
      continue;
    }
    out.push({
      widgetId: String(widgetId),
      version,
      serverCalls: toNumber(r.serverCalls ?? r.server_calls),
      revenue: toNumber(r.revenue),
      revenueEcpm: toNumber(r.revenueEcpm ?? r.revenue_ecpm)
    });
  }
  return out;
}

/**
 * Public entry point used by API routes.
 *
 * Always returns a `PolarisQueryResult` (never throws for "not configured")
 * so the UI can show a clean per-widget "missing data" message when env
 * vars are not set. Actual HTTP / SQL errors are still thrown — the API
 * route surfaces them.
 */
export async function getWidgetReport(
  input: PolarisWidgetQueryInput
): Promise<PolarisQueryResult> {
  const config = readPolarisConfig();
  if (!config) {
    return { rows: [] };
  }
  const rows = await queryPolarisSql(config, input);
  return { rows };
}

/** Useful for the UI to surface a helpful banner when Polaris isn't wired up. */
export function isPolarisConfigured(): boolean {
  return readPolarisConfig() !== undefined;
}
