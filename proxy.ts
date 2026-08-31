import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

/**
 * Next 16's replacement for the middleware convention. Refreshes the Supabase
 * session on every request and gates the app behind the login page.
 */
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets — those never need a
     * session refresh and skipping them keeps navigation snappy.
     *
     * The PWA shell is on that list for a second reason. A service worker that
     * answers with a redirect to the login page does not register at all, and a
     * manifest behind the same redirect never offers the install. Both are build
     * output with nothing personal in them, so neither belongs behind the gate.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|workbox-.*\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
