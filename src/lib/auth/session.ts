import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";

/**
 * Current Better Auth session (parent/guardian), or null.
 *
 * The signed cookie cache is bypassed on purpose: with it, a session revoked from another device
 * ("sign out everywhere", password reset) would keep working here for up to the cache lifetime.
 * Authorization decisions read the database row, so revocation takes effect on the next request.
 */
export async function getParentSession() {
  return auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
}
