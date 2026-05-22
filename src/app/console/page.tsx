"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { JiraEpicSummary } from "@/types/jira";
import { EpicsTable } from "@/components/EpicsTable";
import { ConsoleEpicDetails } from "@/components/ConsoleEpicDetails";

type EpicsState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; epics: JiraEpicSummary[] };

export default function ConsoleDashboardPage() {
  const [state, setState] = useState<EpicsState>({ status: "loading" });
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);
  const [isMock, setIsMock] = useState(false);

  const loadEpics = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/jira/console/epics");
      const body = await res.json();
      if (!res.ok) {
        setState({ status: "error", error: body?.error ?? `HTTP ${res.status}` });
        return;
      }
      setIsMock(Boolean(body.mock));
      setState({ status: "ready", epics: body.epics ?? [] });
    } catch (err) {
      setState({
        status: "error",
        error: err instanceof Error ? err.message : "Failed to load Epics"
      });
    }
  }, []);

  useEffect(() => {
    void loadEpics();
  }, [loadEpics]);

  const epicCount = state.status === "ready" ? state.epics.length : null;

  return (
    <main className="app-shell">
      <Link href="/" className="back-link">
        <span aria-hidden>←</span> Back to Hub
      </Link>

      <header className="app-header">
        <div className="hstack-between" style={{ alignItems: "flex-start" }}>
          <div>
            <div className="hero-eyebrow" style={{ marginBottom: 12 }}>
              <span className="dot" />
              <span>Console · Version Testing</span>
            </div>
            <h1>
              QA Console <span className="text-aurora">Version Testing</span>
            </h1>
            <p>
              Active Video Console version-test Epics from Jira, with their related
              tickets. Console has no Polaris coverage — widget performance lives on
              the Player dashboard.
            </p>
          </div>
        </div>
      </header>

      {isMock ? (
        <div className="info">
          <div>
            <b>Mock mode is on.</b>{" "}
            <span className="muted">
              No Jira credentials detected (or <code>USE_MOCK_DATA=true</code>) — showing
              sample Console Epics. Add your <code>.env.local</code> values to switch to
              live data.
            </span>
          </div>
        </div>
      ) : null}

      <div className="ai-banner" role="status" aria-live="polite">
        <span className="spark" aria-hidden />
        <div>
          {state.status === "ready" ? (
            <>
              <b>AI summary</b>{" "}
              <span className="muted">
                Currently tracking{" "}
                <b style={{ color: "var(--text)" }}>
                  {epicCount} active Console Epic{epicCount === 1 ? "" : "s"}
                </b>
                . Select a row to view its linked tickets, owners and progress.
              </span>
            </>
          ) : state.status === "loading" ? (
            <span className="shimmer">Analyzing active Console Epics…</span>
          ) : (
            <span className="muted">AI summary unavailable while Epics fail to load.</span>
          )}
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Active Console Version Epics</h2>
          <div className="panel-actions">
            <button
              className="primary"
              onClick={() => void loadEpics()}
              disabled={state.status === "loading"}
            >
              {state.status === "loading" ? "Loading…" : "Refresh Epics"}
            </button>
          </div>
        </div>

        {state.status === "loading" ? (
          <p className="muted">Loading Epics from Jira…</p>
        ) : state.status === "error" ? (
          <p className="error">Failed to load Epics: {state.error}</p>
        ) : (
          <EpicsTable
            epics={state.epics}
            selectedKey={selectedKey}
            onSelect={(key) => setSelectedKey(key)}
            emptyMessage="No active Console Version Epics found."
          />
        )}
      </section>

      {selectedKey ? <ConsoleEpicDetails key={selectedKey} epicKey={selectedKey} /> : null}
    </main>
  );
}
