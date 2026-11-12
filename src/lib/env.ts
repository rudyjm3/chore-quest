import { z } from "zod";

/**
 * Server-side environment validation.
 *
 * Import this module only from server code. Values are validated once at
 * startup so misconfiguration fails fast with a readable message instead of
 * surfacing as an obscure runtime error later.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  TEST_DATABASE_URL: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url(),
  NEXT_PUBLIC_APP_URL: z.url(),
  CHILD_SESSION_SECRET: z.string().min(32, "CHILD_SESSION_SECRET must be at least 32 characters"),
  /** Bearer secret for /api/cron/*. Optional so dev works; when unset the cron route is disabled. */
  /** Outgoing mail driver. Only "dev" (store in email_outbox) ships; see docs/development/EMAIL.md. */
  EMAIL_DRIVER: z.enum(["dev"]).default("dev"),
  /** Require a verified email before a parent can sign in. Set "false" only until a provider exists. */
  REQUIRE_EMAIL_VERIFICATION: z.enum(["true", "false"]).default("true"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters").optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid server environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper: clear the cached env so a test can re-validate. */
export function resetServerEnvCache(): void {
  cached = undefined;
}
