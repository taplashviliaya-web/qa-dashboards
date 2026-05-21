import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "QA Player Version Testing Dashboard",
  description:
    "Track Video Player A/B test Epics from Jira, parse widget IDs, and evaluate Polaris performance."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
