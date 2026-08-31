/**
 * next-pwa ships no types, and the DefinitelyTyped package bundles its own copy
 * of Next's config types — an older one, which then disagrees with this app's
 * `NextConfig` over `i18n.domains` and fails the build. So the surface we
 * actually use is declared here instead, against the Next that is installed.
 *
 * Only the options next.config.ts passes are listed. Anything else next-pwa
 * accepts is in its README.
 */
declare module "next-pwa" {
  import type { NextConfig } from "next";

  /** https://developer.chrome.com/docs/workbox/modules/workbox-strategies */
  type StrategyName =
    | "CacheFirst"
    | "CacheOnly"
    | "NetworkFirst"
    | "NetworkOnly"
    | "StaleWhileRevalidate";

  interface RuntimeCaching {
    urlPattern: RegExp | string | ((context: { url: URL; request: Request }) => boolean);
    handler: StrategyName;
    method?: string;
    options?: {
      cacheName?: string;
      networkTimeoutSeconds?: number;
      rangeRequests?: boolean;
      expiration?: {
        maxEntries?: number;
        maxAgeSeconds?: number;
      };
    };
  }

  interface PWAOptions {
    /** Where sw.js and the workbox runtime are written. Effectively always "public". */
    dest: string;
    /** Injects registration into the Pages Router entry, so useless under App Router. */
    register?: boolean;
    /** A new worker takes over on the next load rather than waiting for every tab to close. */
    skipWaiting?: boolean;
    disable?: boolean;
    runtimeCaching?: RuntimeCaching[];
    /** Whether "/" is cached at all. Off here: it is a signed-in document. */
    cacheStartUrl?: boolean;
    dynamicStartUrl?: boolean;
    /** Anything larger stays out of the precache and is fetched on demand. */
    maximumFileSizeToCacheInBytes?: number;
    buildExcludes?: (string | RegExp)[];
    publicExcludes?: string[];
    scope?: string;
    sw?: string;
  }

  export default function withPWAInit(
    options: PWAOptions,
  ): (config: NextConfig) => NextConfig;
}
