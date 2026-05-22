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
      <Link href="/" className="back-link">
        <span aria-hidden>←</span> Back to Hub
      </Link>

      <section className="hero" style={{ paddingTop: 40 }}>
        <div className="hero-eyebrow">
          <span className="dot" style={{ background: "var(--amber)" }} />
          <span>In the pipeline</span>
        </div>
        <div
          style={{
            fontSize: 56,
            lineHeight: 1,
            marginBottom: 12
          }}
        >
          {emoji}
        </div>
        <h1>
          {title}
          <br />
          <span className="text-aurora">coming soon.</span>
        </h1>
        <p>{description}</p>
      </section>

      <section
        className="panel"
        style={{
          textAlign: "center",
          maxWidth: 560,
          margin: "0 auto",
          padding: 28
        }}
      >
        <span className="status-pill coming" style={{ marginBottom: 14 }}>
          <span className="dot" />
          Coming soon
        </span>
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
