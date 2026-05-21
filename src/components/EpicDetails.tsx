"use client";

import { useEffect, useMemo, useState } from "react";
import type { JiraEpicDetails } from "@/types/jira";
import type {
  DateRange,
  WidgetReportResponse,
  WidgetReportRow
} from "@/types/dashboard";
import { defaultDateRange } from "@/lib/dateRange";
import { DateRangePicker } from "./DateRangePicker";
import { WidgetPerformanceTable } from "./WidgetPerformanceTable";
import { StatusBadge, jiraStatusColor } from "./StatusBadge";

type Props = {
  epicKey: string;
};

type LoadState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: T };

export function EpicDetails({ epicKey }: Props) {
  const [details, setDetails] = useState<LoadState<JiraEpicDetails>>({ status: "loading" });
  const [dateRange, setDateRange] = useState<DateRange>(() => defaultDateRange());
  const [report, setReport] = useState<LoadState<WidgetReportRow[]>>({ status: "idle" });

  // Reset state whenever the selected Epic changes.
  useEffect(() => {
    setReport({ status: "idle" });
    setDetails({ status: "loading" });
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jira/epic/${encodeURIComponent(epicKey)}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setDetails({ status: "error", error: body?.error ?? `HTTP ${res.status}` });
          return;
        }
        setDetails({ status: "ready", data: body as JiraEpicDetails });
      } catch (err) {
        if (cancelled) return;
        setDetails({
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load Epic"
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [epicKey]);

  const widgets = useMemo(
    () => (details.status === "ready" ? details.data.abTesting.widgets : []),
    [details]
  );

  const canFetchPolaris = widgets.length > 0;

  const fetchPolaris = async () => {
    setReport({ status: "loading" });
    try {
      const res = await fetch("/api/polaris/widget-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgets,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        })
      });
      const body = await res.json();
      if (!res.ok) {
        setReport({ status: "error", error: body?.error ?? `HTTP ${res.status}` });
        return;
      }
      const data = body as WidgetReportResponse;
      setReport({ status: "ready", data: data.results ?? [] });
    } catch (err) {
      setReport({
        status: "error",
        error: err instanceof Error ? err.message : "Failed to fetch Polaris data"
      });
    }
  };

  const refreshEpic = () => {
    setDetails({ status: "loading" });
    setReport({ status: "idle" });
    // Re-trigger by toggling a dependency would require state; simplest is
    // to inline a tiny fetch here.
    (async () => {
      try {
        const res = await fetch(`/api/jira/epic/${encodeURIComponent(epicKey)}`);
        const body = await res.json();
        if (!res.ok) {
          setDetails({ status: "error", error: body?.error ?? `HTTP ${res.status}` });
          return;
        }
        setDetails({ status: "ready", data: body as JiraEpicDetails });
      } catch (err) {
        setDetails({
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load Epic"
        });
      }
    })();
  };

  if (details.status === "loading") {
    return (
      <div className="panel">
        <p className="muted">Loading Epic details…</p>
      </div>
    );
  }

  if (details.status === "error") {
    return (
      <div className="panel">
        <p className="error">Failed to load Epic: {details.error}</p>
        <button onClick={refreshEpic}>Try again</button>
      </div>
    );
  }

  if (details.status === "idle") return null;

  const epic = details.data;
  const ab = epic.abTesting;

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>{epic.title}</h2>
          <div className="muted" style={{ marginTop: 4 }}>
            <StatusBadge color={jiraStatusColor(epic.status)} label={epic.status} />{" "}
            <a href={epic.url} target="_blank" rel="noopener noreferrer">
              {epic.key}
            </a>
            {epic.playerVersion ? <span> · Version {epic.playerVersion}</span> : null}
          </div>
        </div>
        <div className="panel-actions">
          <button onClick={refreshEpic}>Refresh Epic Details</button>
        </div>
      </div>

      <div className="section-grid two-col">
        <section className="panel" style={{ background: "#fafbfc" }}>
          <div className="panel-header">
            <h2>Related tickets (is blocked by)</h2>
          </div>
          {epic.linkedTickets.length === 0 ? (
            <p className="muted">No tickets linked with “is blocked by”.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticket title</th>
                    <th>Status</th>
                    <th>Jira link</th>
                  </tr>
                </thead>
                <tbody>
                  {epic.linkedTickets.map((t) => (
                    <tr key={t.key}>
                      <td>{t.title}</td>
                      <td>
                        <StatusBadge color={jiraStatusColor(t.status)} label={t.status} />
                      </td>
                      <td>
                        <a href={t.url} target="_blank" rel="noopener noreferrer">
                          {t.key}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel" style={{ background: "#fafbfc" }}>
          <div className="panel-header">
            <h2>A/B Testing sub-task</h2>
            {ab.exists && ab.url ? (
              <a href={ab.url} target="_blank" rel="noopener noreferrer">
                {ab.key}
              </a>
            ) : null}
          </div>

          {!ab.exists ? (
            <p className="warning">{ab.message ?? "A/B Testing sub-task is not created yet."}</p>
          ) : ab.widgets.length === 0 ? (
            <p className="warning">
              {ab.message ?? "No Widget IDs found in the A/B Testing description."}
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Widget ID</th>
                    <th>Widget Name</th>
                  </tr>
                </thead>
                <tbody>
                  {ab.widgets.map((w) => (
                    <tr key={w.widgetId}>
                      <td>{w.widgetId}</td>
                      <td>{w.widgetName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header">
          <h2>Widget performance</h2>
          <div className="panel-actions">
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              onRefresh={fetchPolaris}
              refreshing={report.status === "loading"}
              disabled={!canFetchPolaris}
            />
          </div>
        </div>

        {!canFetchPolaris ? (
          <p className="muted">
            No widgets parsed yet — once the A/B Testing sub-task lists Widget IDs, you can
            fetch Polaris data here.
          </p>
        ) : report.status === "idle" ? (
          <p className="muted">
            Choose a date range (defaults to today) and click <b>Fetch Polaris Data</b>.
          </p>
        ) : report.status === "loading" ? (
          <p className="muted">Fetching Polaris data…</p>
        ) : report.status === "error" ? (
          <p className="error">Polaris error: {report.error}</p>
        ) : (
          <WidgetPerformanceTable rows={report.data} />
        )}
      </section>
    </div>
  );
}
