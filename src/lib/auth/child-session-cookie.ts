import "server-only";

import { cookies } from "next/headers";

import { CHILD_SESSION_COOKIE } from "./child-session";

export async function setChildSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set({
    name: CHILD_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearChildSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(CHILD_SESSION_COOKIE);
}

export async function readChildSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CHILD_SESSION_COOKIE)?.value ?? null;
}
