import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";

/** Current Better Auth session (parent/guardian), or null. */
export async function getParentSession() {
  return auth.api.getSession({ headers: await headers() });
}
