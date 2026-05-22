/**
 * Download + extract Playwright artifacts to a per-runId cache directory
 * under the OS temp folder. Subsequent requests for the same run id
 * skip the network round-trip and the unzip, so the iframe loads in a
 * few hundred ms.
 *
 * Layout on disk (Windows / Linux / macOS):
 *
 *   <os.tmpdir()>/qa-player-dashboard/e2e-reports/<runId>/
 *     index.html
 *     data/
 *     trace/
 *     ...
 *
 * We never write anything outside that directory, and the per-runId
 * scoping means an old report can't be confused for a new one even if
 * runId numbers wrap around — they don't on GitHub, but the principle
 * holds.
 */

import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";

import AdmZip from "adm-zip";

import type { GithubConfig } from "@/lib/githubClient";
import { downloadArtifactZip } from "@/lib/githubClient";

const ROOT_DIR_NAME = "qa-player-dashboard";
const SUB_DIR_NAME = "e2e-reports";

/**
 * In-flight download deduplication: if two requests arrive for the same
 * runId concurrently, the second one awaits the first promise instead
 * of redoing the work. Cleared once the promise settles.
 */
const inflight = new Map<string, Promise<string>>();

/** Path to the runId's extracted-report directory (does not guarantee it exists). */
function reportDir(runId: string): string {
  // runId is numeric on GitHub, but encode anyway in case the contract ever
  // changes — and we strictly accept only digits to be safe against path
  // traversal.
  if (!/^[0-9]+$/.test(runId)) {
    throw new Error(`Invalid runId for cache path: ${runId}`);
  }
  return path.join(os.tmpdir(), ROOT_DIR_NAME, SUB_DIR_NAME, runId);
}

/** Quick "is this directory non-empty?" check. */
async function dirHasContent(dir: string): Promise<boolean> {
  try {
    const entries = await fsp.readdir(dir);
    return entries.length > 0;
  } catch {
    return false;
  }
}

/**
 * Ensure the Playwright report for `runId` is extracted to the local
 * cache. Returns the absolute directory on disk. Subsequent calls for
 * the same runId are cheap (no download, no unzip).
 */
export async function ensureReportExtracted(
  cfg: GithubConfig,
  artifactId: string,
  runId: string
): Promise<string> {
  const dir = reportDir(runId);
  if (await dirHasContent(dir)) return dir;

  const existing = inflight.get(runId);
  if (existing) return existing;

  const promise = (async () => {
    await fsp.mkdir(dir, { recursive: true });
    const zipBuffer = await downloadArtifactZip(cfg, artifactId);
    const zip = new AdmZip(zipBuffer);

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const safeName = sanitizeEntryName(entry.entryName);
      const dest = path.join(dir, safeName);
      // Defence-in-depth: make sure the resolved path stays inside `dir`.
      const resolved = path.resolve(dest);
      if (!resolved.startsWith(path.resolve(dir) + path.sep) && resolved !== path.resolve(dir)) {
        // Skip suspicious entries instead of throwing — we still want
        // the safe entries to land on disk.
        continue;
      }
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.writeFile(dest, entry.getData());
    }
    return dir;
  })();

  inflight.set(runId, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(runId);
  }
}

/**
 * Strip path-traversal sequences and absolute prefixes from a zip
 * entry name so the resolved path stays inside the cache directory.
 */
function sanitizeEntryName(name: string): string {
  // Drop leading slashes / drive letters.
  let cleaned = name.replace(/^(?:[a-zA-Z]:)?[\\/]+/, "");
  // Replace any `..` segment with `_` so it can never escape the dir.
  cleaned = cleaned
    .split(/[\\/]/)
    .map((seg) => (seg === ".." ? "_" : seg))
    .join(path.sep);
  return cleaned;
}

/**
 * Resolve a request-time `relative` path inside the runId's extracted
 * report dir. Returns `undefined` if the path tries to escape or the
 * file doesn't exist.
 */
export function resolveReportFile(
  runId: string,
  relativeParts: string[]
): string | undefined {
  let dir: string;
  try {
    dir = reportDir(runId);
  } catch {
    return undefined;
  }

  // Normalize an empty / "/" request to `index.html`.
  const cleanedParts = relativeParts
    .filter((p) => p !== "" && p !== "." && p !== "..")
    .join("/");
  const target = cleanedParts === "" ? "index.html" : cleanedParts;

  const dest = path.join(dir, target);
  const resolved = path.resolve(dest);
  const baseResolved = path.resolve(dir);

  if (
    resolved !== baseResolved &&
    !resolved.startsWith(baseResolved + path.sep)
  ) {
    return undefined;
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return undefined;
  }
  return resolved;
}

/**
 * Read a CTRF JSON artifact directly into memory.
 *
 * The CTRF artifact contains a single small file (`ctrf-report.json`),
 * so we don't bother persisting it to disk — we just unzip in-memory
 * and return the parsed JSON. Returns `undefined` if no JSON file is
 * present (e.g. the artifact name was right but contents were wrong).
 */
export async function readCtrfReportFromArtifact(
  cfg: GithubConfig,
  artifactId: string
): Promise<unknown | undefined> {
  const zipBuffer = await downloadArtifactZip(cfg, artifactId);
  const zip = new AdmZip(zipBuffer);
  const jsonEntry = zip.getEntries().find(
    (e) => !e.isDirectory && /\.json$/i.test(e.entryName)
  );
  if (!jsonEntry) return undefined;
  const text = jsonEntry.getData().toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * MIME type lookup for the report-proxy route. Limited to the file
 * types Playwright's HTML report actually contains. Unknown types fall
 * back to `application/octet-stream`, which browsers will download
 * rather than render — fine, since the report only references types
 * we know about.
 */
export function contentTypeFor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "html":
    case "htm":
      return "text/html; charset=utf-8";
    case "js":
    case "mjs":
      return "application/javascript; charset=utf-8";
    case "css":
      return "text/css; charset=utf-8";
    case "json":
      return "application/json; charset=utf-8";
    case "svg":
      return "image/svg+xml";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "ico":
      return "image/x-icon";
    case "woff":
      return "font/woff";
    case "woff2":
      return "font/woff2";
    case "ttf":
      return "font/ttf";
    case "otf":
      return "font/otf";
    case "map":
      return "application/json; charset=utf-8";
    case "txt":
    case "log":
      return "text/plain; charset=utf-8";
    case "webm":
      return "video/webm";
    case "mp4":
      return "video/mp4";
    case "zip":
      return "application/zip";
    default:
      return "application/octet-stream";
  }
}
