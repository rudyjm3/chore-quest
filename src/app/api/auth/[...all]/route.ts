import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/auth";

/** Better Auth HTTP endpoints (sign-up, sign-in, session, sign-out, ...). */
export const { GET, POST } = toNextJsHandler(auth);
