import type {
  PolarisQueryResult,
  PolarisWidgetQueryInput,
  PolarisWidgetRow
} from "@/types/polaris";

/**
 * Polaris (Imply) Analytics client — PLACEHOLDER.
 *
 * Real Polaris API details (endpoint, auth, payload shape) will be provided
 * later. To keep the rest of the dashboard fully functional in the meantime,
 * this client:
 *
 *   1. Reads `POLARIS_BASE_URL` / `POLARIS_API_TOKEN` from env.
 *   2. If they're configured, calls `queryPolarisCached` — currently a stub
 *      that throws so we don't silently send invalid requests.
 *   3. If they're not configured, returns an empty result set so the UI can
 *      degrade gracefully and show a "missing data" message per widget.
 *
 * To wire this up:
 *   - Replace `queryPolarisCached` with a real POST to the cached-query
 *     endpoint (see https://docs.imply.io/polaris/api-query-precached/).
 *   - Map the response rows to `PolarisWidgetRow` in `mapPolarisRows`.
 *   - The rest of the pipeline (A/B selection, evaluation, table) requires
 *     no further changes.
 */

const POLARIS_CONFIGURED_FLAG = Symbol("polarisConfigured");

type PolarisConfig = {
  baseUrl: string;
  apiToken: string;
  [POLARIS_CONFIGURED_FLAG]: true;
};

function readPolarisConfig(): PolarisConfig | undefined {
  const baseUrl = process.env.POLARIS_BASE_URL?.replace(/\/$/, "");
  const apiToken = process.env.POLARIS_API_TOKEN;
  if (!baseUrl || !apiToken) return undefined;
  return { baseUrl, apiToken, [POLARIS_CONFIGURED_FLAG]: true };
}

/**
 * Real Polaris query goes here. Once we know the exact endpoint/payload:
 *
 *   // Imply Polaris API keys (pok_*) authenticate via HTTP Basic with the
 *   // key as the username and an empty password.
 *   const auth = Buffer.from(`${config.apiToken}:`).toString("base64");
 *   const res = await fetch(`${config.baseUrl}/v1/projects/<id>/query`, {
 *     method: "POST",
 *     headers: {
 *       Authorization: `Basic ${auth}`,
 *       "Content-Type": "application/json"
 *     },
 *     body: JSON.stringify(buildPrecachedQuery(input))
 *   });
 *   const json = await res.json();
 *   return mapPolarisRows(json);
 */
async function queryPolarisCached(
  _config: PolarisConfig,
  _input: PolarisWidgetQueryInput
): Promise<PolarisWidgetRow[]> {
  // Intentionally not implemented yet. Throw so we never silently return
  // stale/empty data when Polaris IS configured but the integration is
  // incomplete — easier to catch during development.
  throw new Error(
    "Polaris client is not implemented yet. Configure src/lib/polarisClient.ts " +
      "with the real Polaris API details, or unset POLARIS_BASE_URL/POLARIS_API_TOKEN " +
      "to fall back to empty results during development."
  );
}

/**
 * Map raw Polaris rows into our normalized `PolarisWidgetRow` shape.
 * Kept as a separate function so it can be unit-tested independently of the
 * HTTP call once the real schema is known. The `_rawResponse` parameter is
 * intentionally prefixed with `_` so linters know it's a placeholder.
 */
export function mapPolarisRows(_rawResponse: unknown): PolarisWidgetRow[] {
  return [];
}

/**
 * Public entry point used by API routes.
 *
 * Always returns a `PolarisQueryResult` (never throws for "not configured")
 * so the UI can show a clean per-widget "missing data" message during the
 * development phase.
 */
export async function getWidgetReport(
  input: PolarisWidgetQueryInput
): Promise<PolarisQueryResult> {
  const config = readPolarisConfig();
  if (!config) {
    return { rows: [] };
  }
  const rows = await queryPolarisCached(config, input);
  return { rows };
}

/** Useful for the UI to surface a helpful banner when Polaris isn't wired up. */
export function isPolarisConfigured(): boolean {
  return readPolarisConfig() !== undefined;
}
