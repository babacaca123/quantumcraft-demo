"use client";

import { useEffect } from "react";

/**
 * Registers the worker next-pwa writes to public/sw.js at build time.
 *
 * next-pwa can do this itself, but it does it by prepending its script to the
 * Pages Router client entry — `main.js` — and an App Router build has no such
 * entry. So `register: true` there is silently a no-op, and this is the hook
 * that actually turns the thing on.
 *
 * There is no worker at all in development (the plugin is disabled), and none
 * in a browser that does not support one. Both are fine: nothing in the app
 * depends on it, it only makes the shell survive a lost signal.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("[sw] registration failed", error);
    });
  }, []);

  return null;
}
