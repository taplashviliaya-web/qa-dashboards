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
isPolarisConfigured(): boolean
```

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
