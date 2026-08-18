import type { Metadata } from "next";
import { Barlow_Semi_Condensed, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const barlow = Barlow_Semi_Condensed({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-barlow",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
  display: "swap",
});

const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "House Build Tracker — Restea Automation",
  description:
    "Phase-based cost and task tracker for an owner-builder: subcontractors, tasks, receipts, and a final profit report.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${serif.variable} ${plex.variable}`}>
      <body>{children}</body>
    </html>
  );
}
