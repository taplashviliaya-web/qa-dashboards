"use client";

import { useEffect, useState } from "react";
import type { JiraConsoleEpicDetails } from "@/types/jira";
import { StatusBadge, jiraStatusColor } from "./StatusBadge";

type Props = {
  epicKey: string;
};

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: T };

/**
 * Detail panel for a Console Epic.
 *
 * Mirrors the layout of {@link EpicDetails} (header + related tickets)
 * but deliberately omits the A/B Testing task and the Polaris widget
 * performance section — Console doesn't have Polaris coverage and the
 * brief calls for "just Epics list and related tickets".
 */
export function ConsoleEpicDetails({ epicKey }: Props) {
  const [details, setDetails] = useState<LoadState<JiraConsoleEpicDetails>>({
    status: "loading"
  });

  useEffect(() => {
    setDetails({ status: "loading" });
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/jira/console/epic/${encodeURIComponent(epicKey)}`
        );
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setDetails({ status: "error", error: body?.error ?? `HTTP ${res.status}` });
          return;
        }
        setDetails({ status: "ready", data: body as JiraConsoleEpicDetails });
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

  const refreshEpic = () => {
    setDetails({ status: "loading" });
    (async () => {
      try {
        const res = await fetch(
          `/api/jira/console/epic/${encodeURIComponent(epicKey)}`
        );
        const body = await res.json();
        if (!res.ok) {
          setDetails({ status: "error", error: body?.error ?? `HTTP ${res.status}` });
          return;
        }
        setDetails({ status: "ready", data: body as JiraConsoleEpicDetails });
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

  const epic = details.data;

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
          </div>
        </div>
        <div className="panel-actions">
          <button onClick={refreshEpic}>Refresh Epic Details</button>
        </div>
      </div>

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
    </div>
  );
}
