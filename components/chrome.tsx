"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The Restea mark from the theme sample — rust curve resolving into a route-green line. */
export function Wordmark({ label = "House Build Tracker" }: { label?: string }) {
  return (
    <Link href="/" className="wordmark">
      <svg viewBox="0 0 40 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M2 24 Q 8 10, 14 20 T 20 8" stroke="#B5502E" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 8 L 38 8" stroke="#3F6B4F" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {label}
    </Link>
  );
}

const LINKS = [
  { href: "/", label: "Phases" },
  { href: "/files", label: "All Files" },
  { href: "/report", label: "Report" },
];

export function AppNav({ signOut }: { signOut: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <nav className="appnav">
      <Wordmark />
      <div className="navlinks">
        {LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href} className={active ? "active" : undefined}>
              {link.label}
            </Link>
          );
        })}
        {signOut}
      </div>
    </nav>
  );
}

/** The hand-drawn rule from the theme sample, used to break up long pages. */
export function Divider() {
  return (
    <div className="divider">
      <svg viewBox="0 0 200 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M2 18 Q 20 6, 35 16 Q 48 24, 60 12 L 198 12"
          stroke="#5C6660"
          strokeWidth="1.5"
          fill="none"
          opacity="0.5"
        />
      </svg>
    </div>
  );
}

export function AppFooter() {
  return (
    <footer className="appfoot">
      <h3>Every phase, every check, every receipt — in one running total.</h3>
      <div className="foot-meta">
        restea automation
        <br />
        house build tracker · v1
      </div>
    </footer>
  );
}
