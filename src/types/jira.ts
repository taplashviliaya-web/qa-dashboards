export type JiraEpicSummary = {
  key: string;
  title: string;
  status: string;
  url: string;
};

export type JiraLinkedTicket = {
  key: string;
  title: string;
  status: string;
  url: string;
};

export type ParsedWidget = {
  widgetId: string;
  widgetName: string;
};

export type AbTestingSection = {
  exists: boolean;
  key?: string;
  status?: string;
  url?: string;
  widgets: ParsedWidget[];
  message?: string;
};

export type JiraEpicDetails = {
  key: string;
  title: string;
  status: string;
  url: string;
  playerVersion?: string;
  linkedTickets: JiraLinkedTicket[];
  abTesting: AbTestingSection;
};

/**
 * Console Epic details. Same shape as a Player Epic but without the
 * A/B Testing / widget pieces — the Console dashboard only shows the
 * Epic itself and its `is blocked by` linked tickets.
 */
export type JiraConsoleEpicDetails = {
  key: string;
  title: string;
  status: string;
  url: string;
  linkedTickets: JiraLinkedTicket[];
};

/**
 * Minimal subset of the Jira REST API issue payload that we read in this app.
 * We intentionally keep this loose to avoid coupling to every Jira field.
 */
export type JiraIssueRaw = {
  key: string;
  self?: string;
  fields: {
    summary?: string;
    description?: unknown;
    status?: { name?: string };
    issuetype?: { name?: string; subtask?: boolean };
    parent?: { key?: string };
    subtasks?: Array<{
      key: string;
      fields?: {
        summary?: string;
        status?: { name?: string };
      };
    }>;
    issuelinks?: Array<{
      type?: { name?: string; inward?: string; outward?: string };
      inwardIssue?: {
        key: string;
        fields?: {
          summary?: string;
          status?: { name?: string };
        };
      };
      outwardIssue?: {
        key: string;
        fields?: {
          summary?: string;
          status?: { name?: string };
        };
      };
    }>;
  };
};

export type JiraSearchResponse = {
  issues?: JiraIssueRaw[];
  total?: number;
};
