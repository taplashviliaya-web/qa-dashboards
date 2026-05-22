"use client";

import Link from "next/link";

export default function ComingSoonPage({
  title,
  emoji,
  description,
  funnySentence
}: {
  title: string;
  emoji: string;
  description: string;
  funnySentence: string;
}) {
  return (
    <main className="app-shell">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Dashboards</Link>
        <span className="sep">/</span>
        <span className="current">{title}</span>
      </nav>

      <header className="app-header">
        <div className="header-row">
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
            <div className="meta-row">
              <span
                className="status-pill coming"
                style={{ marginTop: 4 }}
              >
                <span className="dot" />
                Coming soon
              </span>
            </div>
          </div>
        </div>
      </header>

      <section
        className="panel"
        style={{
          maxWidth: 640,
          margin: "0 auto",
          width: "100%",
          textAlign: "center",
          padding: 32
        }}
      >
        <div
          className="hub-card-icon"
          style={{
            margin: "0 auto 16px",
            width: 56,
            height: 56,
            fontSize: 28
          }}
        >
          {emoji}
        </div>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-muted)",
            lineHeight: 1.65,
            marginBottom: 18,
            fontStyle: "italic"
          }}
        >
          “{funnySentence}”
        </p>
        <p style={{ fontSize: 12, color: "var(--text-subtle)", margin: 0 }}>
          We&apos;re working hard to bring this dashboard to life. Check back soon.
        </p>
      </section>
    </main>
  );
}
