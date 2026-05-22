import type {
  JiraConsoleEpicDetails,
  JiraEpicDetails,
  JiraEpicSummary,
  JiraIssueRaw,
  JiraLinkedTicket,
  JiraSearchResponse
} from "@/types/jira";
import { parseWidgets } from "@/lib/parseWidgets";
import { parsePlayerVersion } from "@/lib/parseVersion";

const EPIC_JQL = [
  'summary ~ "Video Player Version Tests"',
  "type = Epic",
  "status NOT IN (Resolved, Rejected)"
].join(" AND ");

/**
 * JQL for the Console Dashboard — same shape as the Player one, with
 * "Player" swapped for "Console" so we get the corresponding
 * `Video Console Version Tests …` Epics.
 */
const CONSOLE_EPIC_JQL = [
  'summary ~ "Video Console Version Tests"',
  "type = Epic",
  "status NOT IN (Resolved, Rejected)"
].join(" AND ");

const EPIC_SEARCH_FIELDS = ["summary", "status"];

const EPIC_DETAIL_FIELDS = [
  "summary",
  "status",
  "issuelinks",
  "issuetype"
];

/**
 * Name of the child issue that contains the A/B Testing widget list.
 *
 * IMPORTANT: in the TRUV project, "A/B Testing" is an Epic child of
 * type **Task** (not the legacy "Sub-task" issue type), so it does NOT
 * appear in `issue.fields.subtasks`. We resolve it via a JQL search on
 * `parent = <epicKey> AND summary ~ "A/B Testing"` instead.
 */
const AB_TESTING_TASK_NAME = "A/B Testing";

/** Read required env vars; throws a clean Error if any are missing. */
function getJiraConfig(): {
  baseUrl: string;
  email: string;
  apiToken: string;
} {
  const baseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, "");
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!baseUrl) throw new Error("JIRA_BASE_URL is not set");
  if (!email) throw new Error("JIRA_EMAIL is not set");
  if (!apiToken) throw new Error("JIRA_API_TOKEN is not set");

  return { baseUrl, email, apiToken };
}

function authHeader(email: string, apiToken: string): string {
  const token = Buffer.from(`${email}:${apiToken}`).toString("base64");
  return `Basic ${token}`;
}

async function jiraFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { baseUrl, email, apiToken } = getJiraConfig();
  const url = `${baseUrl}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader(email, apiToken),
      ...(init.headers ?? {})
    },
    cache: "no-store"
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Jira request failed: ${res.status} ${res.statusText}` +
        (body ? ` — ${body.slice(0, 500)}` : "")
    );
  }

  return (await res.json()) as T;
}

function buildIssueUrl(baseUrl: string, key: string): string {
  return `${baseUrl}/browse/${key}`;
}

/**
 * Atlassian Document Format (ADF) descriptions are nested JSON. We
 * recursively walk the tree and concatenate every text node, preserving
 * paragraph/list breaks as newlines so the line-based widget parser works.
 */
export function adfToPlainText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(adfToPlainText).join("");

  if (typeof node === "object") {
    const n = node as { type?: string; text?: string; content?: unknown };
    let out = "";
    if (typeof n.text === "string") out += n.text;
    if (n.content) out += adfToPlainText(n.content);

    const blockTypes = new Set([
      "paragraph",
      "heading",
      "listItem",
      "bulletList",
      "orderedList",
      "codeBlock",
      "blockquote",
      "hardBreak",
      "rule"
    ]);
    if (n.type && blockTypes.has(n.type)) out += "\n";
    return out;
  }

  return "";
}

function normalizeDescription(description: unknown): string {
  if (!description) return "";
  if (typeof description === "string") return description;
  return adfToPlainText(description);
}

function toEpicSummary(issue: JiraIssueRaw, baseUrl: string): JiraEpicSummary {
  return {
    key: issue.key,
    title: issue.fields.summary ?? "(no title)",
    status: issue.fields.status?.name ?? "Unknown",
    url: buildIssueUrl(baseUrl, issue.key)
  };
}

/**
 * Get active Player Version Epics matching the JQL in the spec.
 *
 * NOTE: Jira allows up to 100 results per page; the QA team is unlikely to
 * have more than that in flight, but we expose `maxResults` if needed later.
 */
export async function getActiveEpics(maxResults = 100): Promise<JiraEpicSummary[]> {
  const { baseUrl } = getJiraConfig();
  const params = new URLSearchParams({
    jql: EPIC_JQL,
    fields: EPIC_SEARCH_FIELDS.join(","),
    maxResults: String(maxResults)
  });

  // Atlassian deprecated /rest/api/3/search in 2025 (returns 410 Gone).
  // The replacement is /rest/api/3/search/jql — same auth, same query
  // parameters we care about (jql, fields, maxResults). Pagination changed
  // from startAt/total to nextPageToken/isLast, but we cap at a single page
  // here (the QA team won't have >100 active Player Version Epics at once).
  const data = await jiraFetch<JiraSearchResponse>(`/rest/api/3/search/jql?${params.toString()}`);
  const issues = data.issues ?? [];
  return issues.map((issue) => toEpicSummary(issue, baseUrl));
}

/**
 * Extract linked tickets where the current Epic `is blocked by` the other
 * issue. In Jira's link object, an "is blocked by" relationship is the
 * INWARD side of the "Blocks" link type.
 */
function extractIsBlockedBy(issue: JiraIssueRaw, baseUrl: string): JiraLinkedTicket[] {
  const links = issue.fields.issuelinks ?? [];
  const tickets: JiraLinkedTicket[] = [];

  for (const link of links) {
    const inward = link.type?.inward?.toLowerCase();
    if (inward !== "is blocked by") continue;
    const target = link.inwardIssue;
    if (!target) continue;

    tickets.push({
      key: target.key,
      title: target.fields?.summary ?? "(no title)",
      status: target.fields?.status?.name ?? "Unknown",
      url: buildIssueUrl(baseUrl, target.key)
    });
  }

  return tickets;
}

/** Fetch a single issue with the fields we need (including description). */
async function getIssue(key: string, fields: string[]): Promise<JiraIssueRaw> {
  const params = new URLSearchParams({ fields: fields.join(",") });
  return jiraFetch<JiraIssueRaw>(`/rest/api/3/issue/${encodeURIComponent(key)}?${params.toString()}`);
}

/**
 * Locate the "A/B Testing" child Task of an Epic, including its description.
 *
 * Returns the first matching issue (key + status + description) or
 * `undefined` if none exists. We deliberately do the lookup as a single
 * search call (rather than list-children-then-fetch) so the description
 * comes back in the same round-trip — typical Player Version Epics have
 * exactly one A/B Testing task, so `maxResults=5` is plenty.
 */
async function findAbTestingChild(epicKey: string): Promise<JiraIssueRaw | undefined> {
  const jql = `parent = "${epicKey}" AND summary ~ "\\"${AB_TESTING_TASK_NAME}\\""`;
  const params = new URLSearchParams({
    jql,
    fields: "summary,status,description",
    maxResults: "5"
  });
  const data = await jiraFetch<JiraSearchResponse>(
    `/rest/api/3/search/jql?${params.toString()}`
  );
  const issues = data.issues ?? [];
  // Defensive: prefer an exact (case-insensitive, trimmed) summary match so
  // we don't accidentally pick up an unrelated ticket like "A/B Testing
  // dashboard improvements".
  const exact = issues.find(
    (i) =>
      (i.fields.summary ?? "").trim().toLowerCase() === AB_TESTING_TASK_NAME.toLowerCase()
  );
  return exact ?? issues[0];
}

/**
 * Get full details for an Epic: linked tickets and the A/B Testing
 * sub-task (with parsed widgets). Safe against partial data: a missing
 * sub-task surfaces a friendly message rather than throwing.
 */
export async function getEpicDetails(key: string): Promise<JiraEpicDetails> {
  const { baseUrl } = getJiraConfig();
  const epic = await getIssue(key, EPIC_DETAIL_FIELDS);

  const title = epic.fields.summary ?? "(no title)";
  const status = epic.fields.status?.name ?? "Unknown";
  const url = buildIssueUrl(baseUrl, epic.key);
  const linkedTickets = extractIsBlockedBy(epic, baseUrl);
  const playerVersion = parsePlayerVersion(title);

  const abIssue = await findAbTestingChild(epic.key);

  if (!abIssue) {
    return {
      key: epic.key,
      title,
      status,
      url,
      playerVersion,
      linkedTickets,
      abTesting: {
        exists: false,
        widgets: [],
        message: "A/B Testing task is not created yet."
      }
    };
  }

  const descriptionText = normalizeDescription(abIssue.fields.description);
  const widgets = parseWidgets(descriptionText);

  return {
    key: epic.key,
    title,
    status,
    url,
    playerVersion,
    linkedTickets,
    abTesting: {
      exists: true,
      key: abIssue.key,
      status: abIssue.fields.status?.name ?? "Unknown",
      url: buildIssueUrl(baseUrl, abIssue.key),
      widgets,
      message:
        widgets.length === 0
          ? "No Widget IDs found in the A/B Testing description."
          : undefined
    }
  };
}

/* ---------------------------- Console Dashboard --------------------------- */

/**
 * Get active Console Epics. Mirrors {@link getActiveEpics} but uses the
 * Console JQL so the dashboard only sees `Video Console Version Tests`
 * Epics that are not Resolved/Rejected.
 */
export async function getActiveConsoleEpics(
  maxResults = 100
): Promise<JiraEpicSummary[]> {
  const { baseUrl } = getJiraConfig();
  const params = new URLSearchParams({
    jql: CONSOLE_EPIC_JQL,
    fields: EPIC_SEARCH_FIELDS.join(","),
    maxResults: String(maxResults)
  });

  const data = await jiraFetch<JiraSearchResponse>(
    `/rest/api/3/search/jql?${params.toString()}`
  );
  const issues = data.issues ?? [];
  return issues.map((issue) => toEpicSummary(issue, baseUrl));
}

/**
 * Get details for a single Console Epic: title, status, link, and the
 * `is blocked by` linked tickets. We deliberately skip the A/B Testing
 * / widgets logic — the Console dashboard does not surface Polaris.
 */
export async function getConsoleEpicDetails(
  key: string
): Promise<JiraConsoleEpicDetails> {
  const { baseUrl } = getJiraConfig();
  const epic = await getIssue(key, EPIC_DETAIL_FIELDS);

  return {
    key: epic.key,
    title: epic.fields.summary ?? "(no title)",
    status: epic.fields.status?.name ?? "Unknown",
    url: buildIssueUrl(baseUrl, epic.key),
    linkedTickets: extractIsBlockedBy(epic, baseUrl)
  };
}
