# Security

## Implemented in the foundation

| Area                   | Control                                                                                                                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parent auth            | Better Auth email+password, min 10 chars, 14-day sessions refreshed daily, httpOnly cookies, built-in rate limits (sign-in 10/min, sign-up 5/min)                                            |
| Child auth             | Family code + scrypt-hashed PIN, 5-attempt lockout (15 min), opaque 256-bit tokens stored as HMAC, separate cookie, revocation on archive; device hand-over revokes the parent session first |
| Route gating           | `src/proxy.ts` cookie presence check (fast path) + layout and action-level context resolution (authoritative)                                                                                |
| Authorization          | `ParentContext` vs `ChildContext` types; `assertFamilyScope`, `assertPermission` (OWNER/GUARDIAN), `requireChildInFamily`; every query filtered by `familyId`                                |
| Cross-family isolation | Integration tests prove a parent cannot approve/assign/adjust/start sessions for another family's child, and that foreign records read as not found                                          |
| Input validation       | Zod at every action/route boundary (`parseOrThrow`); JSON config validated on load                                                                                                           |
| Integrity              | DB uniqueness, CHECK constraints, row locks, idempotency keys for all credits/grants                                                                                                         |
| Audit                  | `audit_log` rows for family/child/task/goal creation, approvals (incl. automatic), reward adjustments, redemptions, PIN changes, child sessions                                              |
| Secrets                | Server-only env validated by `src/lib/env.ts`; nothing secret in `NEXT_PUBLIC_*`; `.env` git-ignored                                                                                         |
| Headers                | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`                                                                                                   |
| Error handling         | `runAction` never leaks internal errors to clients                                                                                                                                           |
| Dependencies           | Pinned Prisma/Better Auth versions; lockfile committed; `pnpm install --frozen-lockfile` in CI                                                                                               |

## Phase 2 additions

- **Cron route** `/api/cron/maintenance`: constant-time Bearer check against `CRON_SECRET`; fails closed (503) when unset. It is not covered by
  `proxy.ts`, so the secret is the only gate. It accepts no input.
- **Guardian invitations**: 256-bit random token, only its SHA-256 stored; single use (row lock on accept); 7-day expiry; bound to the invited
  email; OWNER only; at most 10 open invites; unknown/used/expired tokens are indistinguishable; audit entries never contain the address.
- **Email verification / reset**: Better Auth tokens (reset link valid 1 h, verification 24 h), sessions revoked on password reset, auth endpoints
  rate limited. The reset request never reveals whether an address exists. Mail links are never logged.
- **Post-auth redirects** only accept same-site relative paths (`safeNext`).
- **PIN reset** revokes all of the child's sessions. **Family code rotation** (OWNER) invalidates the old code immediately.
- **Dev email driver** stores links in `email_outbox`; in production it logs a warning (mail is not delivered) and `/dev/outbox` returns 404.

## Deferred (tracked in ROADMAP.md)

- Content-Security-Policy (after the asset/CDN decision), HSTS at the platform level.
- Edge rate limiting for child sign-in and health endpoint (Better Auth covers parent endpoints only).
- A real email provider (verification/reset/invites currently use the development driver), 2FA for parents.
- Dependency scanning in CI (`pnpm audit`, Dependabot/Renovate).
- Session device listing / "sign out everywhere" for parents.
- Formal threat model and penetration test before pilot.

## Operational rules

- Never run migrations, resets or seeds against production from a developer machine.
- Rotate `BETTER_AUTH_SECRET` and `CHILD_SESSION_SECRET` only with a session-invalidation plan.
- Database credentials and Supabase service-role keys live only in Vercel/CI secrets.

## Session revocation (Phase 3)

Parent session reads (`getParentSession`) bypass Better Auth's signed cookie cache (`disableCookieCache`), so "sign out everywhere" and
password-reset revocations apply on the very next request instead of after the cache lifetime. `src/proxy.ts` still only checks that a
session cookie exists; authorization is enforced by `requireParentContext()` in layouts, actions and route handlers.
