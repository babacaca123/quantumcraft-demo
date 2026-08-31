import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

/**
 * What the service worker holds on to, and — just as deliberately — what it does
 * not.
 *
 * Everything here is build output: hashed filenames, fonts, the icons. A file at
 * one of these URLs is the same file forever, so serving it from disk is never
 * wrong, and having it on disk is what lets the app open at all on a site with
 * no signal.
 *
 * Nothing else is listed, which means documents, RSC payloads, `/api/*` and the
 * Supabase calls all go straight to the network with the worker standing aside.
 * That is the point rather than an omission: those carry live money figures
 * behind a login, and a stale total served confidently from a cache is worse
 * than a page that admits it cannot reach the server.
 */
const runtimeCaching = [
  {
    // Hashed by the build, so the bytes behind a URL never change.
    urlPattern: /\/_next\/static\/.+/i,
    handler: "CacheFirst" as const,
    options: {
      cacheName: "next-static",
      expiration: { maxEntries: 128, maxAgeSeconds: 30 * 24 * 60 * 60 },
    },
  },
  {
    urlPattern: /\.(?:woff2?|ttf|otf|eot)$/i,
    handler: "CacheFirst" as const,
    options: {
      cacheName: "static-fonts",
      expiration: { maxEntries: 16, maxAgeSeconds: 365 * 24 * 60 * 60 },
    },
  },
  {
    // The icons, and anything else dropped into public/.
    urlPattern: /\.(?:png|jpg|jpeg|gif|svg|ico|webp)$/i,
    handler: "StaleWhileRevalidate" as const,
    options: {
      cacheName: "static-images",
      expiration: { maxEntries: 64, maxAgeSeconds: 7 * 24 * 60 * 60 },
    },
  },
];

const withPWA = withPWAInit({
  dest: "public",
  // next-pwa injects its registration into the Pages Router entry, which this
  // app does not have. components/service-worker.tsx does it instead.
  register: false,
  skipWaiting: true,
  runtimeCaching,
  // next-pwa caches "/" by default. Here "/" is a signed-in page that redirects
  // to the login when it is not, so keeping a copy of it means keeping a copy of
  // someone's money on disk to serve back later. The list above is the whole of
  // what this worker holds.
  cacheStartUrl: false,
  // The runtime half of the same switch — cacheStartUrl alone only keeps "/" out
  // of the precache, and leaves a NetworkFirst rule behind still filing it away.
  dynamicStartUrl: false,
  // The pdf.js worker is megabytes on its own. It is cached the first time a PDF
  // receipt is opened rather than downloaded up front by every install.
  maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
});

const config: NextConfig = {
  reactStrictMode: true,
};

/**
 * Wrapped for the production build only.
 *
 * next-pwa's `disable` option is checked inside the webpack hook, which means
 * the hook is attached either way — and `next dev` runs Turbopack, which refuses
 * to start next to a webpack config rather than quietly ignoring it. So dev
 * never sees the plugin at all: Turbopack, no service worker, nothing cached
 * between reloads. `npm run build` passes `--webpack` and gets the worker.
 */
export default process.env.NODE_ENV === "production" ? withPWA(config) : config;
