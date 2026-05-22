"use client";

import Link from "next/link";

type Dashboard = {
  slug: string;
  title: string;
  description: string;
  status: "ready" | "coming_soon";
  /** Image src for the icon tile (preferred). Falls back to `emoji` if absent. */
  iconSrc?: string;
  emoji?: string;
  meta: string;
  funnySentence?: string;
};

const dashboards: Dashboard[] = [
  {
    slug: "player",
    title: "Player Dashboard",
    description:
      "Video Player version-tests and A/B widget performance from Jira and Polaris.",
    status: "ready",
    iconSrc: "/truvid-logo.png",
    meta: "Live · Jira + Polaris"
  },
  {
    slug: "console",
    title: "Console Version",
    description:
      "Active Video Console version-tests Epics from Jira and their related tickets.",
    status: "ready",
    emoji: "▤",
    meta: "Live · Jira"
  },
  {
    slug: "admin",
    title: "Admin Panel",
    description: "System configuration, user management, and analytics.",
    status: "coming_soon",
    emoji: "👑",
    meta: "In planning",
    funnySentence:
      "With great admin powers comes great responsibility… and lots of settings."
  },
  {
    slug: "polaris",
    title: "Polaris Analytics",
    description: "Deep-dive into widget performance and monetization metrics.",
    status: "coming_soon",
    emoji: "✦",
    meta: "In planning",
    funnySentence: "Even the stars need time to align. We're working on it."
  }
];

export default function DashboardHub() {
  const activeCount = dashboards.filter((d) => d.status === "ready").length;
  const comingCount = dashboards.length - activeCount;

  return (
    <main className="app-shell">
      <nav className="crumbs" aria-label="Breadcrumb">
        <span>Branovate Video</span>
        <span className="sep">/</span>
        <span>QA</span>
        <span className="sep">/</span>
        <span className="current">Dashboards</span>
      </nav>

      <header className="app-header">
        <div className="header-row">
          <div>
            <h1>Welcome back, QA team.</h1>
            <div className="meta-row">
              <span className="mono">{dashboards.length} dashboards</span>
              <span className="dot-sep">·</span>
              <span className="mono">{activeCount} active</span>
              <span className="dot-sep">·</span>
              <span className="mono">{comingCount} coming soon</span>
            </div>
          </div>
        </div>
      </header>

      <section className="hub-grid">
        {dashboards.map((dashboard) => {
          const isReady = dashboard.status === "ready";
          const inner = (
            <article className={`hub-card ${isReady ? "" : "is-coming"}`}>
              <div className="hub-card-head">
                <div
                  className={`hub-card-icon ${dashboard.iconSrc ? "hub-card-icon-image" : ""}`}
                >
                  {dashboard.iconSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={dashboard.iconSrc}
                      alt=""
                      width={38}
                      height={38}
                    />
                  ) : (
                    dashboard.emoji
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2>{dashboard.title}</h2>
                  <div className="hub-card-meta">{dashboard.meta}</div>
                </div>
                <span
                  className={`status-pill ${isReady ? "active" : "coming"}`}
                  style={{ flexShrink: 0 }}
                >
                  <span className="dot" />
                  {isReady ? "Active" : "Coming soon"}
                </span>
              </div>

              <p>{dashboard.description}</p>

              {!isReady && dashboard.funnySentence ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "var(--text-subtle)",
                    fontStyle: "italic"
                  }}
                >
                  “{dashboard.funnySentence}”
                </p>
              ) : null}

              <div
                className="hub-card-footer"
                style={{ justifyContent: isReady ? "flex-end" : "flex-start" }}
              >
                {isReady ? (
                  <span className="hub-card-cta">
                    Launch <span aria-hidden>→</span>
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>
                    In the pipeline
                  </span>
                )}
              </div>
            </article>
          );

          return isReady ? (
            <Link
              key={dashboard.slug}
              href={`/${dashboard.slug}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              {inner}
            </Link>
          ) : (
            <div key={dashboard.slug}>{inner}</div>
          );
        })}
      </section>

      <footer
        style={{
          textAlign: "left",
          color: "var(--text-subtle)",
          fontSize: 12,
          paddingTop: 20,
          marginTop: 8,
          borderTop: "1px solid var(--border)"
        }}
      >
        <p style={{ margin: 0 }}>
          Built with Next.js · Jira + Polaris integrated · Mock mode when credentials
          are missing.
        </p>
      </footer>
    </main>
  );
}
