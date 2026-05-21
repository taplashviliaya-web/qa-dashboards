"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { JiraEpicSummary } from "@/types/jira";
import { EpicsTable } from "@/components/EpicsTable";
import { EpicDetails } from "@/components/EpicDetails";

type EpicsState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; epics: JiraEpicSummary[] };

export default function PlayerDashboardPage() {
  const [state, setState] = useState<EpicsState>({ status: "loading" });
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);
  const [isMock, setIsMock] = useState(false);

  const loadEpics = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/jira/epics");
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
      <header className="app-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div>
            <h1>QA Player Version Testing Dashboard</h1>
            <p>
              Active Video Player Version-Tests Epics from Jira, with A/B widget performance from
              Polaris.
            </p>
          </div>
          <Link href="/" style={{ marginTop: 4, fontSize: 13, color: "var(--link)" }}>
            ← Back to Hub
          </Link>
        </div>
      </header>

      {isMock ? (
        <div className="info">
          <b>Mock mode is on.</b> No Jira credentials detected (or{" "}
          <code>USE_MOCK_DATA=true</code>), so this preview is showing sample Epics and Polaris
          rows. Add your <code>.env.local</code> values to switch to live data.
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-header">
          <h2>Active Player Version Epics</h2>
          <div className="panel-actions">
            <button onClick={() => void loadEpics()} disabled={state.status === "loading"}>
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
          />
        )}
      </section>

      {selectedKey ? <EpicDetails key={selectedKey} epicKey={selectedKey} /> : null}
    </main>
  );
}
