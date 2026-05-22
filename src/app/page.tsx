"use client";

import Link from "next/link";
import { useState } from "react";

type Dashboard = {
  slug: string;
  title: string;
  description: string;
  status: "ready" | "coming_soon";
  emoji: string;
  funnySentence: string;
};

const dashboards: Dashboard[] = [
  {
    slug: "player",
    title: "Player Dashboard",
    description: "Track Video Player Version Tests & A/B performance from Jira + Polaris",
    status: "ready",
    emoji: "▶️",
    funnySentence: ""
  },
  {
    slug: "console",
    title: "Console Version",
    description: "Track Video Console Version Tests Epics from Jira and their related tickets",
    status: "ready",
    emoji: "💻",
    funnySentence: ""
  },
  {
    slug: "admin",
    title: "Admin Panel",
    description: "System configuration, user management, and analytics",
    status: "coming_soon",
    emoji: "👑",
    funnySentence: "With great admin powers comes great responsibility... and lots of settings."
  },
  {
    slug: "polaris",
    title: "Polaris Analytics",
    description: "Deep dive into widget performance and monetization metrics",
    status: "coming_soon",
    emoji: "✨",
    funnySentence: "Even the stars need time to align. We're working on it ⭐"
  }
];

export default function DashboardHub() {
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

  return (
    <main className="app-shell">
      <header className="app-header" style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>🎬 QA Dashboards Hub</h1>
        <p style={{ fontSize: 15, maxWidth: 600, margin: "0 auto" }}>
          Your command center for Video Player testing, debugging, and analytics.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 24,
          marginBottom: 40
        }}
      >
        {dashboards.map((dashboard) => (
          <div
            key={dashboard.slug}
            onMouseEnter={() => setHoveredSlug(dashboard.slug)}
            onMouseLeave={() => setHoveredSlug(null)}
            style={{
              textDecoration: "none",
              cursor: dashboard.status === "ready" ? "pointer" : "default"
            }}
          >
            <Link
              href={dashboard.status === "ready" ? `/${dashboard.slug}` : "#"}
              style={{ textDecoration: "none" }}
            >
              <div
                className="panel"
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  transition: "all 0.2s ease",
                  transform:
                    hoveredSlug === dashboard.slug && dashboard.status === "ready"
                      ? "translateY(-4px)"
                      : "none",
                  boxShadow:
                    hoveredSlug === dashboard.slug && dashboard.status === "ready"
                      ? "0 12px 24px rgba(0, 0, 0, 0.12)"
                      : "0 1px 3px rgba(0, 0, 0, 0.05)",
                  opacity: dashboard.status === "coming_soon" ? 0.75 : 1,
                  pointerEvents: dashboard.status === "coming_soon" ? "none" : "auto"
                }}
              >
                <div style={{ fontSize: 36 }}>{dashboard.emoji}</div>

                <div>
                  <h2 style={{ margin: "0 0 4px 0", fontSize: 18 }}>
                    {dashboard.title}
                  </h2>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                    {dashboard.description}
                  </p>
                </div>

                {dashboard.status === "ready" ? (
                  <div
                    style={{
                      marginTop: "auto",
                      display: "inline-block",
                      padding: "6px 12px",
                      backgroundColor: "var(--status-green-bg)",
                      color: "var(--status-green-text)",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      width: "fit-content"
                    }}
                  >
                    Ready
                  </div>
                ) : (
                  <div>
                    <div
                      style={{
                        marginTop: "auto",
                        display: "inline-block",
                        padding: "6px 12px",
                        backgroundColor: "var(--status-orange-bg)",
                        color: "var(--status-orange-text)",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        width: "fit-content",
                        marginBottom: 8
                      }}
                    >
                      Coming Soon
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: "var(--text-muted)",
                        fontStyle: "italic"
                      }}
                    >
                      &ldquo;{dashboard.funnySentence}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </Link>
          </div>
        ))}
      </div>

      <div
        style={{
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: 12,
          paddingTop: 20,
          borderTop: "1px solid var(--border)"
        }}
      >
        <p>
          Built with Next.js · Jira + Polaris integrated · Mock mode when credentials are missing
        </p>
      </div>
    </main>
  );
}
