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
      <header className="app-header" style={{ textAlign: "center" }}>
        <Link href="/" style={{ marginBottom: 32, display: "inline-block", fontSize: 13 }}>
          ← Back to Hub
        </Link>
        <div style={{ fontSize: 64, marginBottom: 16 }}>{emoji}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>

      <section className="panel" style={{ textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: "var(--text)" }}>
          Coming Soon ⏳
        </div>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 24 }}>
          "{funnySentence}"
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          We're working hard to bring this dashboard to life. Check back soon!
        </p>
      </section>
    </main>
  );
}
