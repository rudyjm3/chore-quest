"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client (parents only). No `baseURL`: the client
 * targets the current origin, so the same build works on any host/port.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
