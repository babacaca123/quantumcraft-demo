import type { Metadata, Viewport } from "next";
import { Barlow_Semi_Condensed, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import { ServiceWorker } from "@/components/service-worker";
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
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  /**
   * iOS reads none of the manifest for home-screen installs — it wants its own
   * meta tags, and without `capable` it opens the bookmark in Safari with the
   * address bar still there. `default` is the light status bar: ink on kraft,
   * which is what the page underneath it is.
   */
  appleWebApp: {
    capable: true,
    title: "Build Tracker",
    statusBarStyle: "default",
  },
  other: {
    // `capable` above emits the standardised `mobile-web-app-capable`, which
    // Safari only started honouring in iOS 17.4. The old spelling costs one line
    // and is the difference between a home-screen app and a Safari bookmark on
    // anything older.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Kraft, so the status bar and the page it sits above are the same colour and
  // the seam between them disappears once installed.
  themeColor: "#EDE6D6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${serif.variable} ${plex.variable}`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
