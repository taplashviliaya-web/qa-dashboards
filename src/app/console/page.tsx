"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { JiraEpicSummary } from "@/types/jira";
import { EpicsTable } from "@/components/EpicsTable";
import { ConsoleEpicDetails } from "@/components/ConsoleEpicDetails";
import { E2eSection } from "@/components/E2eSection";

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

  return (
    <main className="app-shell">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Dashboards</Link>
        <span className="sep">/</span>
        <span className="current">Console Version</span>
      </nav>

      <header className="app-header">
        <div className="header-row">
          <div>
            <h1>Console Version Testing</h1>
            <p>
              Active Video Console version-test Epics from Jira, with their related
              tickets. Console has no Polaris coverage — widget performance lives on the
              Player dashboard.
            </p>
          </div>
          <div className="header-actions">
            <button
              className="primary"
              onClick={() => void loadEpics()}
              disabled={state.status === "loading"}
            >
              {state.status === "loading" ? "Refreshing…" : "Refresh"}
            </button>
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

      <section className="panel">
        <div className="panel-header">
          <h2>Active Console Version Epics</h2>
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

      <E2eSection />
    </main>
  );
}
