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
    title: "Console Dashboard",
    description:
      "Active Console version Jira Epics and Playwright e2e automation status.",
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
            <h1>Welcome to Dashboards Hub</h1>
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

              <p className="hub-card-desc">{dashboard.description}</p>

              <p className="hub-card-quote">
                {!isReady && dashboard.funnySentence
                  ? `“${dashboard.funnySentence}”`
                  : ""}
              </p>

              <div className="hub-card-footer">
                <span className="hub-card-footer-status">
                  {isReady ? "" : "In the pipeline"}
                </span>
                {isReady ? (
                  <span className="hub-card-cta">
                    Launch <span aria-hidden>→</span>
                  </span>
                ) : null}
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
