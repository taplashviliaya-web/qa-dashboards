"use client";

import Link from "next/link";

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
    description:
      "Track Video Player version tests & A/B performance from Jira + Polaris.",
    status: "ready",
    emoji: "▶️",
    funnySentence: ""
  },
  {
    slug: "console",
    title: "Console Version",
    description:
      "Track Video Console version-tests Epics from Jira and their related tickets.",
    status: "ready",
    emoji: "💻",
    funnySentence: ""
  },
  {
    slug: "admin",
    title: "Admin Panel",
    description: "System configuration, user management, and analytics.",
    status: "coming_soon",
    emoji: "👑",
    funnySentence:
      "With great admin powers comes great responsibility… and lots of settings."
  },
  {
    slug: "polaris",
    title: "Polaris Analytics",
    description: "Deep-dive into widget performance and monetization metrics.",
    status: "coming_soon",
    emoji: "✨",
    funnySentence: "Even the stars need time to align. We're working on it."
  }
];

export default function DashboardHub() {
  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-eyebrow">
          <span className="dot" />
          <span>QA · Branovate Video Intelligence</span>
        </div>
        <h1>
          Your <span className="text-aurora">command center</span>
          <br />
          for video QA & analytics.
        </h1>
        <p>
          Jira-backed Epic tracking, Polaris widget performance and version-test
          intelligence — all in one place.
        </p>
      </section>

      <div className="hub-grid">
        {dashboards.map((dashboard) => {
          const isReady = dashboard.status === "ready";
          const content = (
            <article className={`hub-card ${isReady ? "" : "hub-card-disabled"}`}>
              <div className="hstack-between">
                <div className="hub-card-icon">{dashboard.emoji}</div>
                {isReady ? (
                  <span className="status-pill ready">
                    <span className="dot" />
                    Live
                  </span>
                ) : (
                  <span className="status-pill coming">
                    <span className="dot" />
                    Coming soon
                  </span>
                )}
              </div>

              <div>
                <h2>{dashboard.title}</h2>
                <p>{dashboard.description}</p>
              </div>

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

              <div className="hub-card-footer">
                <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>
                  {isReady ? "Open dashboard" : "In the pipeline"}
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
              {content}
            </Link>
          ) : (
            <div key={dashboard.slug}>{content}</div>
          );
        })}
      </div>

      <footer
        style={{
          textAlign: "center",
          color: "var(--text-subtle)",
          fontSize: 12,
          paddingTop: 28,
          marginTop: 8,
          borderTop: "1px solid var(--border)"
        }}
      >
        <p style={{ margin: 0 }}>
          Built with Next.js · Jira + Polaris integrated · Mock mode when credentials
          are missing.
        </p>
      </footer>

      <button type="button" className="ask-ai" aria-label="Ask AI">
        <span className="spark" aria-hidden />
        Ask AI
        <kbd>⌘K</kbd>
      </button>
    </main>
  );
}
