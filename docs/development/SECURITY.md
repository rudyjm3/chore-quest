# Security

## Implemented in the foundation

| Area                   | Control                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parent auth            | Better Auth email+password, min 10 chars, 14-day sessions refreshed daily, httpOnly cookies, built-in rate limits (sign-in 10/min, sign-up 5/min)             |
| Child auth             | Family code + scrypt-hashed PIN, 5-attempt lockout (15 min), opaque 256-bit tokens stored as HMAC, separate cookie, revocation on archive                     |
| Route gating           | `src/proxy.ts` cookie presence check (fast path) + layout and action-level context resolution (authoritative)                                                 |
| Authorization          | `ParentContext` vs `ChildContext` types; `assertFamilyScope`, `assertPermission` (OWNER/GUARDIAN), `requireChildInFamily`; every query filtered by `familyId` |
| Cross-family isolation | Integration tests prove a parent cannot approve/assign/adjust/start sessions for another family's child, and that foreign records read as not found           |
| Input validation       | Zod at every action/route boundary (`parseOrThrow`); JSON config validated on load                                                                            |
| Integrity              | DB uniqueness, CHECK constraints, row locks, idempotency keys for all credits/grants                                                                          |
| Audit                  | `audit_log` rows for family/child/task/goal creation, approvals (incl. automatic), reward adjustments, redemptions, PIN changes, child sessions               |
| Secrets                | Server-only env validated by `src/lib/env.ts`; nothing secret in `NEXT_PUBLIC_*`; `.env` git-ignored                                                          |
| Headers                | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`                                                                    |
| Error handling         | `runAction` never leaks internal errors to clients                                                                                                            |
| Dependencies           | Pinned Prisma/Better Auth versions; lockfile committed; `pnpm install --frozen-lockfile` in CI                                                                |

## Deferred (tracked in ROADMAP.md)

- Content-Security-Policy (after the asset/CDN decision), HSTS at the platform level.
- Edge rate limiting for child sign-in and health endpoint (Better Auth covers parent endpoints only).
- Email verification and password reset (needs an email provider), 2FA for parents.
- Dependency scanning in CI (`pnpm audit`, Dependabot/Renovate).
- Session device listing / "sign out everywhere" for parents.
- Formal threat model and penetration test before pilot.

## Operational rules

- Never run migrations, resets or seeds against production from a developer machine.
- Rotate `BETTER_AUTH_SECRET` and `CHILD_SESSION_SECRET` only with a session-invalidation plan.
- Database credentials and Supabase service-role keys live only in Vercel/CI secrets.
