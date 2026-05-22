# QA Player Version Testing Dashboard

A small Next.js + TypeScript dashboard for the QA team. It pulls active
**Video Player Version Tests** Epics from Jira, surfaces the `A/B Testing`
sub-task, parses Widget IDs from its description, and (once the Polaris
client is wired up) evaluates each widget's A/B performance based on
Revenue eCPM with a 50/50 traffic-split sanity check.

---

## Features

- Loads active Player Version Epics from Jira (`Resolved` / `Rejected` are
  excluded).
- Shows Epic title, status and Jira link in a simple table.
- For a selected Epic, shows linked tickets with the `is blocked by`
  relation.
- Finds the `A/B Testing` sub-task and parses Widget IDs / Names from its
  description. Supports `-`, `–`, `:`, `|` as separators.
- Date range picker (defaults to **today**).
- Calls a Polaris client wrapper to fetch widget performance (currently a
  clean placeholder — see "Polaris" below).
- Evaluates each widget:
  - Validates 50/50 server-call split with ±3% tolerance.
  - Approves only when split is valid **and** B Revenue eCPM > A.
  - Marks **Needs Review** when B eCPM is higher but B Revenue is lower.
  - Marks **Invalid Split** when split is outside tolerance.
  - Marks **Missing Data** when Polaris returns nothing or only one of
    A/B versions.

---

## Tech stack

- Next.js 14 (App Router) + TypeScript + React 18
- Server-side API routes for all Jira / Polaris calls (no secrets in the
  browser)
- No external UI library — plain CSS for a clean, neutral look

---

## Project layout

```
qa-player-dashboard/
  .env.example
  .gitignore
  README.md
  package.json
  tsconfig.json
  next.config.mjs
  src/
    app/
      layout.tsx
      page.tsx
      globals.css
      api/
        jira/
          epics/route.ts
          epic/[key]/route.ts
        polaris/
          widget-report/route.ts
    components/
      EpicsTable.tsx
      EpicDetails.tsx
      WidgetPerformanceTable.tsx
      DateRangePicker.tsx
      StatusBadge.tsx
    lib/
      jiraClient.ts
      polarisClient.ts          # placeholder — see below
      parseWidgets.ts
      parseVersion.ts
      approvalLogic.ts
      dateRange.ts
      widgetReport.ts           # combines Polaris rows + approval logic
    types/
      jira.ts
      polaris.ts
      dashboard.ts
```

---

## Getting started

### 1. Install

```bash
cd qa-player-dashboard
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```env
JIRA_BASE_URL=https://branovate.atlassian.net
JIRA_EMAIL=you@branovate.com
JIRA_API_TOKEN=your-jira-api-token

# Polaris (Imply) — required for real A/B performance numbers.
# If any of these are blank, the dashboard falls back to "Missing Data"
# per widget so the rest of the UI keeps working.
POLARIS_BASE_URL=https://<org>.<region>.<cloud>.api.imply.io
POLARIS_API_TOKEN=pok_xxx
POLARIS_PROJECT_ID=<project-uuid>
POLARIS_TABLE=<druid-table-name>
# Druid table that maps widget_id -> page_url events. Used to surface the
# top video URL each widget runs on. Defaults to `urls` when unset.
POLARIS_URLS_TABLE=urls

DEFAULT_REPORT_DATE_MODE=today
AUTO_REFRESH_ENABLED=false
AUTO_REFRESH_INTERVAL_SECONDS=300
```

> Create a Jira API token at: <https://id.atlassian.com/manage-profile/security/api-tokens>

`.env.local` is gitignored. Never commit real tokens.

### 3. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

### 4. Type-check / build

```bash
npm run typecheck
npm run build
```

---

## API routes

All routes are server-side; they read tokens from environment variables
and never expose them to the browser.

### `GET /api/jira/epics`

Returns active Player Version Epics:

```ts
{
  epics: Array<{
    key: string;
    title: string;
    status: string;
    url: string;
  }>
}
```

JQL used:

```
summary ~ "Video Player Version Tests"
AND type = Epic
AND status NOT IN (Resolved, Rejected)
```

### `GET /api/jira/epic/[key]`

Returns Epic detail + `is blocked by` links + parsed A/B widgets.

### `POST /api/polaris/widget-report`

Input:

```ts
{
  widgets: Array<{ widgetId: string; widgetName: string }>;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}
```

Output: per-widget evaluation rows (see `WidgetReportRow` in
`src/types/dashboard.ts`).

---

## Polaris client

`src/lib/polarisClient.ts` talks to the Polaris synchronous SQL endpoint
(`POST /v1/projects/<id>/query/sql`) and aggregates per widget + version:

| Field          | Source                                          |
|----------------|-------------------------------------------------|
| `widgetId`     | `widget_id`                                     |
| `version`      | `version`                                       |
| `serverCalls`  | `SUM(server_calls)`                             |
| `revenue`      | `SUM(revenue)`                                  |
| `revenueEcpm`  | `SUM(revenue) / SUM(server_calls) * 1000`       |

The time filter uses `__time >= TIMESTAMP '<start> 00:00:00'` and an
exclusive upper bound of `<endDate + 1 day> 00:00:00`, so the full local
day on both ends is included.

Public surface used by API routes:

```ts
getWidgetReport({ widgetIds, startDate, endDate }): Promise<{ rows: PolarisWidgetRow[] }>
getWidgetTopUrls({ widgetIds, startDate, endDate }): Promise<{ rows: PolarisWidgetUrlRow[] }>
isPolarisConfigured(): boolean
```

### Top page URL per widget

Alongside the A/B numbers we also query the `POLARIS_URLS_TABLE` (default
`urls`) to surface the top page each widget is currently running on:

```sql
SELECT
  CAST("widget_id" AS VARCHAR) AS "widgetId",
  CAST("page_url"  AS VARCHAR) AS "pageUrl",
  COUNT(*) AS "eventCount"
FROM "urls"
WHERE CAST("widget_id" AS VARCHAR) IN (?, ?, ...)
  AND __time >= TIMESTAMP '<start> 00:00:00'
  AND __time <  TIMESTAMP '<endDate + 1> 00:00:00'
GROUP BY 1, 2
ORDER BY 1, "eventCount" DESC
```

The dashboard picks the URL with the highest `eventCount` per `widgetId`
and renders it in the **Top Page URL** column as a clickable link. If the
URLs query fails or returns nothing for a widget, the column shows `—`
and the rest of the row is unaffected.

Behaviour when env vars are missing:

- If any of `POLARIS_BASE_URL` / `POLARIS_API_TOKEN` /
  `POLARIS_PROJECT_ID` / `POLARIS_TABLE` is **not set**, the dashboard
  shows `Missing Data` per widget — the rest of the UI is fully
  functional.
- HTTP / SQL errors from Polaris are surfaced in the API response so
  they're visible during development.

### Helper scripts

- `node scripts/test-credentials.mjs` — pings Jira `/myself` and Polaris
  `/v1/projects` to verify both tokens.
- `node scripts/inspect-polaris.mjs` — prints the columns of
  `POLARIS_TABLE`, its `__time` range, and a sample row. Useful when the
  table schema changes.
- `node scripts/test-widget-query.mjs <widgetId> [...] [--from] [--to]` —
  runs the dashboard's A/B SQL against `POLARIS_TABLE` for the given
  widgets.
- `node scripts/test-widget-urls.mjs <widgetId> [...] [--from] [--to] [--limit]`
  — runs the URL-leaderboard SQL against `POLARIS_URLS_TABLE` and prints
  the top page URLs per widget along with the URL the dashboard would
  pick.
- `node scripts/test-github-e2e.mjs` — verifies the Console dashboard's
  GitHub PAT can see the e2e workflow + its artifacts (see "Console /
  E2E section" below).

---

## Console / E2E section

The Console dashboard (`/console`) shows two things side-by-side:

1. **Jira**: active "Console Version Tests" Epics and their `is blocked
   by` linked tickets (same pattern as the Player dashboard, minus the
   A/B Testing widgets).
2. **E2E Test Results**: the latest Playwright run from the
   `branovate-ltd/truvidConsole` repo's `e2e.yml` workflow, surfaced as
   a summary card + a toggleable embedded HTML report.

### How it works

```
[ truvidConsole · e2e.yml on GitHub Actions ]
  runs `npx playwright test` with html + CTRF reporters
  uploads artifacts:  playwright-report  playwright-traces  test-screenshots  ctrf-report
                                                                                │
[ qa-player-dashboard ]                                                          │
  /api/e2e/latest-run         ── GET latest run + parse ctrf-report ────────────┤
  /api/e2e/report/<runId>/…   ── proxy the playwright-report artifact contents ─┘
  /console                    ── E2eSection: summary tiles, failed tests, iframe
```

The GitHub PAT lives in `.env` (server-side only) — no token ever
reaches the browser. The proxy route downloads + unzips the
`playwright-report` artifact once per `runId` into the OS temp
directory, then streams files into an `<iframe>` so the official
Playwright report (with all per-test screenshots, videos and traces)
renders inside the dashboard.

### One-time setup in `truvidConsole`

The dashboard expects the workflow to upload a `ctrf-report` artifact
in addition to its existing artifacts. Add this step at the end of the
job in `.github/workflows/e2e.yml` (after the screenshots upload):

```yaml
      - name: Upload CTRF Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ctrf-report
          path: ctrf/ctrf-report.json
          retention-days: 7
```

No change to `playwright.config.ts` is needed — the CTRF JSON is already
generated for the `ctrf-io/github-test-reporter` step. We're just
publishing it as an artifact too.

### Env vars

Add to `.env` (gitignored):

```env
# Fine-grained PAT with read-only Actions + Contents on the e2e repo.
# https://github.com/settings/personal-access-tokens/new
GITHUB_TOKEN=github_pat_...

E2E_REPO_OWNER=branovate-ltd
E2E_REPO_NAME=truvidConsole
E2E_WORKFLOW_FILE=e2e.yml
E2E_BRANCH=development
```

If any of these are missing the dashboard falls back to a built-in
**mock E2E run** so the page is still demoable — a yellow banner makes
it obvious.

### Verifying the integration

```bash
node scripts/test-github-e2e.mjs
```

This script confirms:

1. The PAT is valid (`GET /user`).
2. It can see the workflow file (`GET /actions/workflows/<file>`).
3. It can list recent runs and inspect their artifacts.
4. The most recent run has both `playwright-report` and `ctrf-report`
   artifacts (the dashboard needs both).

### Failure modes the UI handles

| State | Cause | What you see |
|---|---|---|
| `ready` | Latest run has a parseable CTRF artifact. | Totals tiles + failed tests + embed. |
| `mock` (ready) | No `GITHUB_TOKEN` set. | Sample run + yellow "mock mode" banner. |
| `not_configured` | Missing one of the 4 GitHub env vars. | List of vars to set. |
| `no_runs` | Branch has no workflow runs. | Hint to trigger a manual run. |
| `no_ctrf_artifact` | Run exists but `ctrf-report` missing/expired. | Other artifact links still surface; explainer banner. |
| `error` | GitHub API call failed (auth, network, …). | Error message + Retry button. |

---

## Approval logic (cheat-sheet)

| Condition                                             | Status         | Color  |
|-------------------------------------------------------|----------------|--------|
| Split valid, B Revenue eCPM > A, B Revenue ≥ A        | Approved       | Green  |
| Split valid, B Revenue eCPM > A, but B Revenue < A    | Needs Review   | Orange |
| Split valid, B Revenue eCPM ≤ A                       | Not Approved   | Red    |
| Split invalid (outside 47–53% per side)               | Invalid Split  | Orange |
| Total server calls = 0 / one of A/B missing in Polaris| Missing Data   | Gray   |

Split valid range: each side between **47% and 53%** (±3% tolerance).

---

## Intentionally out of scope (for now)

- Writing approval status / comments back to Jira
- CSV / Excel export
- Database / historical storage
- Multi-user auth
- Auto-refresh (config is in env but disabled)

The code is structured so these can be added later without major refactors.
