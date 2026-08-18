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
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
