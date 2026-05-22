import type {
  JiraConsoleEpicDetails,
  JiraEpicDetails,
  JiraEpicSummary
} from "@/types/jira";
import type { PolarisWidgetRow, PolarisWidgetUrlRow } from "@/types/polaris";
import { parsePlayerVersion } from "@/lib/parseVersion";

/**
 * Mock-mode toggle.
 *
 * Active when:
 *   - USE_MOCK_DATA is explicitly set to "true", OR
 *   - any of the required Jira env vars is missing (handy for first-run preview).
 *
 * The dashboard shows a small banner when this is on so it's obvious you're
 * looking at fake data.
 */
export function isMockMode(): boolean {
  if (process.env.USE_MOCK_DATA === "true") return true;
  if (
    !process.env.JIRA_BASE_URL ||
    !process.env.JIRA_EMAIL ||
    !process.env.JIRA_API_TOKEN
  ) {
    return true;
  }
  return false;
}

const MOCK_BASE_URL = "https://branovate.atlassian.net";

function url(key: string): string {
  return `${MOCK_BASE_URL}/browse/${key}`;
}

/* --------------------------------- Epics --------------------------------- */

export const MOCK_EPICS: JiraEpicSummary[] = [
  {
    key: "PLAY-1042",
    title: "Video Player - Version Tests - v6.62-rc3 (Shadow DOM)",
    status: "In Progress",
    url: url("PLAY-1042")
  },
  {
    key: "PLAY-1031",
    title: "Video Player - Version Tests - v6.61-rc3B (eCPM Tweaks)",
    status: "In QA",
    url: url("PLAY-1031")
  },
  {
    key: "PLAY-1019",
    title: "Video Player - Version Tests - v6.58-rc4 (Opportunity Trigger)",
    status: "In Review",
    url: url("PLAY-1019")
  },
  {
    key: "PLAY-1001",
    title: "Video Player - Version Tests - v6.21-rc1",
    status: "To Do",
    url: url("PLAY-1001")
  }
];

/* ----------------------------- Epic details ------------------------------ */

const PLAY_1042_DETAILS: JiraEpicDetails = {
  key: "PLAY-1042",
  title: "Video Player - Version Tests - v6.62-rc3 (Shadow DOM)",
  status: "In Progress",
  url: url("PLAY-1042"),
  playerVersion: parsePlayerVersion(
    "Video Player - Version Tests - v6.62-rc3 (Shadow DOM)"
  ),
  linkedTickets: [
    {
      key: "PLAY-1043",
      title: "Shadow DOM event listeners regression",
      status: "In Progress",
      url: url("PLAY-1043")
    },
    {
      key: "PLAY-1044",
      title: "VAST wrapper compatibility check",
      status: "In Review",
      url: url("PLAY-1044")
    },
    {
      key: "PLAY-1045",
      title: "Player init perf budget",
      status: "Done",
      url: url("PLAY-1045")
    }
  ],
  abTesting: {
    exists: true,
    key: "PLAY-1042-1",
    status: "In Progress",
    url: url("PLAY-1042-1"),
    widgets: [
      { widgetId: "13837", widgetName: "birgun.net_Instream" },
      { widgetId: "7875", widgetName: "Anymind JP_footballchannel.jp_Instream_DT" },
      {
        widgetId: "6379",
        widgetName: "SaniiTV_setn.com_Instream_Entertainment_Android"
      },
      { widgetId: "10255", widgetName: "Vidi_haberturk.com_Instream" },
      { widgetId: "9921", widgetName: "Vidi_sozcu.com.tr_Instream" }
    ]
  }
};

const PLAY_1031_DETAILS: JiraEpicDetails = {
  key: "PLAY-1031",
  title: "Video Player - Version Tests - v6.61-rc3B (eCPM Tweaks)",
  status: "In QA",
  url: url("PLAY-1031"),
  playerVersion: parsePlayerVersion(
    "Video Player - Version Tests - v6.61-rc3B (eCPM Tweaks)"
  ),
  linkedTickets: [
    {
      key: "PLAY-1032",
      title: "Bidder timeout tuning",
      status: "Blocked",
      url: url("PLAY-1032")
    },
    {
      key: "PLAY-1033",
      title: "Floor price refactor",
      status: "In Progress",
      url: url("PLAY-1033")
    }
  ],
  abTesting: {
    exists: true,
    key: "PLAY-1031-1",
    status: "In Progress",
    url: url("PLAY-1031-1"),
    widgets: [
      { widgetId: "10255", widgetName: "Vidi_haberturk.com_Instream" },
      { widgetId: "13837", widgetName: "birgun.net_Instream" }
    ]
  }
};

const PLAY_1019_DETAILS: JiraEpicDetails = {
  key: "PLAY-1019",
  title: "Video Player - Version Tests - v6.58-rc4 (Opportunity Trigger)",
  status: "In Review",
  url: url("PLAY-1019"),
  playerVersion: parsePlayerVersion(
    "Video Player - Version Tests - v6.58-rc4 (Opportunity Trigger)"
  ),
  linkedTickets: [
    {
      key: "PLAY-1020",
      title: "Trigger fires before player ready",
      status: "Done",
      url: url("PLAY-1020")
    }
  ],
  abTesting: {
    exists: true,
    key: "PLAY-1019-1",
    status: "Done",
    url: url("PLAY-1019-1"),
    // Empty widgets — exercises the "No Widget IDs found" branch.
    widgets: []
  }
};

const PLAY_1001_DETAILS: JiraEpicDetails = {
  key: "PLAY-1001",
  title: "Video Player - Version Tests - v6.21-rc1",
  status: "To Do",
  url: url("PLAY-1001"),
  playerVersion: parsePlayerVersion("Video Player - Version Tests - v6.21-rc1"),
  linkedTickets: [],
  // No sub-task yet — exercises the "A/B Testing sub-task is not created yet" branch.
  abTesting: {
    exists: false,
    widgets: [],
    message: "A/B Testing sub-task is not created yet."
  }
};

const DETAILS_BY_KEY: Record<string, JiraEpicDetails> = {
  "PLAY-1042": PLAY_1042_DETAILS,
  "PLAY-1031": PLAY_1031_DETAILS,
  "PLAY-1019": PLAY_1019_DETAILS,
  "PLAY-1001": PLAY_1001_DETAILS
};

export function getMockEpicDetails(key: string): JiraEpicDetails | undefined {
  return DETAILS_BY_KEY[key];
}

/* --------------------------- Console Dashboard --------------------------- */

export const MOCK_CONSOLE_EPICS: JiraEpicSummary[] = [
  {
    key: "CONS-512",
    title: "Video Console - Version Tests - v3.18 (Inventory Hub)",
    status: "In Progress",
    url: url("CONS-512")
  },
  {
    key: "CONS-498",
    title: "Video Console - Version Tests - v3.17 (Playlist Editor)",
    status: "In QA",
    url: url("CONS-498")
  },
  {
    key: "CONS-470",
    title: "Video Console - Version Tests - v3.15 (Widget Manager Refresh)",
    status: "In Review",
    url: url("CONS-470")
  },
  {
    key: "CONS-441",
    title: "Video Console - Version Tests - v3.12",
    status: "To Do",
    url: url("CONS-441")
  }
];

const CONS_512_DETAILS: JiraConsoleEpicDetails = {
  key: "CONS-512",
  title: "Video Console - Version Tests - v3.18 (Inventory Hub)",
  status: "In Progress",
  url: url("CONS-512"),
  linkedTickets: [
    {
      key: "CONS-513",
      title: "Inventory Hub: bulk edit modal regression",
      status: "In Progress",
      url: url("CONS-513")
    },
    {
      key: "CONS-514",
      title: "Inventory filters lose state on tab switch",
      status: "In Review",
      url: url("CONS-514")
    },
    {
      key: "CONS-515",
      title: "Inventory Hub keyboard navigation polish",
      status: "Done",
      url: url("CONS-515")
    }
  ]
};

const CONS_498_DETAILS: JiraConsoleEpicDetails = {
  key: "CONS-498",
  title: "Video Console - Version Tests - v3.17 (Playlist Editor)",
  status: "In QA",
  url: url("CONS-498"),
  linkedTickets: [
    {
      key: "CONS-499",
      title: "Playlist Editor: drag handle hit area too small",
      status: "Blocked",
      url: url("CONS-499")
    },
    {
      key: "CONS-500",
      title: "Playlist autosave race condition",
      status: "In Progress",
      url: url("CONS-500")
    }
  ]
};

const CONS_470_DETAILS: JiraConsoleEpicDetails = {
  key: "CONS-470",
  title: "Video Console - Version Tests - v3.15 (Widget Manager Refresh)",
  status: "In Review",
  url: url("CONS-470"),
  linkedTickets: [
    {
      key: "CONS-471",
      title: "Widget Manager column resize persists incorrectly",
      status: "Done",
      url: url("CONS-471")
    }
  ]
};

const CONS_441_DETAILS: JiraConsoleEpicDetails = {
  key: "CONS-441",
  title: "Video Console - Version Tests - v3.12",
  status: "To Do",
  url: url("CONS-441"),
  linkedTickets: []
};

const CONSOLE_DETAILS_BY_KEY: Record<string, JiraConsoleEpicDetails> = {
  "CONS-512": CONS_512_DETAILS,
  "CONS-498": CONS_498_DETAILS,
  "CONS-470": CONS_470_DETAILS,
  "CONS-441": CONS_441_DETAILS
};

export function getMockConsoleEpicDetails(
  key: string
): JiraConsoleEpicDetails | undefined {
  return CONSOLE_DETAILS_BY_KEY[key];
}

/* ------------------------------- Polaris -------------------------------- */

/**
 * Polaris mock rows. We design these to cover every UI state at once:
 *
 *   13837 -> Approved          (B eCPM higher, B Revenue higher, valid split)
 *   7875  -> Not Approved      (B eCPM lower, valid split)
 *   6379  -> Needs Review      (B eCPM higher, but B Revenue lower)
 *   10255 -> Invalid Split     (B got ~60% traffic)
 *   9921  -> Missing Data      (no rows at all)
 */
const MOCK_POLARIS_ROWS: PolarisWidgetRow[] = [
  // 13837 — clean approval
  {
    widgetId: "13837",
    version: "6.62",
    serverCalls: 132_184,
    revenueEcpm: 1.2,
    revenue: 158.62
  },
  {
    widgetId: "13837",
    version: "6.62-rc3B",
    serverCalls: 131_790,
    revenueEcpm: 1.45,
    revenue: 191.1
  },

  // 7875 — B is worse
  {
    widgetId: "7875",
    version: "6.62",
    serverCalls: 88_410,
    revenueEcpm: 2.1,
    revenue: 185.66
  },
  {
    widgetId: "7875",
    version: "6.62-rc3B",
    serverCalls: 89_204,
    revenueEcpm: 1.78,
    revenue: 158.78
  },

  // 6379 — B eCPM higher but B Revenue lower (less traffic on B side, still inside tolerance)
  {
    widgetId: "6379",
    version: "6.62",
    serverCalls: 52_300,
    revenueEcpm: 0.92,
    revenue: 48.12
  },
  {
    widgetId: "6379",
    version: "6.62-rc3B",
    serverCalls: 49_650,
    revenueEcpm: 0.95,
    revenue: 47.17
  },

  // 10255 — invalid split (~60/40 in favour of B)
  {
    widgetId: "10255",
    version: "6.62",
    serverCalls: 54_010,
    revenueEcpm: 1.1,
    revenue: 59.41
  },
  {
    widgetId: "10255",
    version: "6.62-rc3B",
    serverCalls: 81_700,
    revenueEcpm: 1.3,
    revenue: 106.21
  }

  // 9921 intentionally has no rows -> "Missing Data"
];

/**
 * Filter mock Polaris rows by requested widget IDs. Date range is ignored in
 * mock mode — the same rows are returned regardless. That's fine for a UI
 * preview.
 */
export function getMockPolarisRows(widgetIds: string[]): PolarisWidgetRow[] {
  const set = new Set(widgetIds);
  return MOCK_POLARIS_ROWS.filter((r) => set.has(r.widgetId));
}

/**
 * Mock (widget_id, page_url) aggregates. Mirrors the shape of the live
 * `urls` table so the dashboard's "Top Page URL" column has something
 * realistic to render in mock mode. Widget 9921 is intentionally omitted
 * to exercise the no-URL branch in the UI.
 */
const MOCK_POLARIS_URL_ROWS: PolarisWidgetUrlRow[] = [
  {
    widgetId: "13837",
    pageUrl: "https://www.birgun.net/haber/spor-gundemi-canli-yayin",
    eventCount: 58
  },
  {
    widgetId: "13837",
    pageUrl: "https://www.birgun.net/haber/ekonomi-bulteni",
    eventCount: 42
  },
  {
    widgetId: "7875",
    pageUrl: "https://www.footballchannel.jp/2026/05/21/post-feature-japan",
    eventCount: 71
  },
  {
    widgetId: "6379",
    pageUrl: "https://www.setn.com/News.aspx?NewsID=entertainment-top",
    eventCount: 35
  },
  {
    widgetId: "10255",
    pageUrl: "https://www.haberturk.com/gundem/haber/canli-yayin",
    eventCount: 49
  }
];

export function getMockPolarisUrlRows(
  widgetIds: string[]
): PolarisWidgetUrlRow[] {
  const set = new Set(widgetIds);
  return MOCK_POLARIS_URL_ROWS.filter((r) => set.has(r.widgetId));
}
