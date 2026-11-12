# ADR 0008 — EmailSender interface with a development driver

Status: accepted (Phase 2)

## Context

Phase 2 needs email verification, password reset and guardian invitations. No paid email service may be signed up for or required, and
tests plus local development must still be able to read the links.

## Decision

- `EmailSender { send(message) }` in `src/lib/email`; Better Auth callbacks and the invitation service depend only on it.
- The only driver is `dev`: it persists messages in `email_outbox` (so the e2e process, vitest and the running server share one store)
  and logs the message kind only. A dev-only page `/dev/outbox` renders it; the page is a 404 in production.
- Real providers are a new file plus an `EMAIL_DRIVER` value (steps in `docs/development/EMAIL.md`).
- Email verification is on by default (`REQUIRE_EMAIL_VERIFICATION=true`) with an explicit opt-out for deployments with no provider.
- Invitations: random 256-bit token, SHA-256 stored, email-bound, single use via row lock, 7-day expiry, OWNER only. The owner is shown the
  link once as a delivery fallback; a failing sender never fails invitation creation.
- `email_outbox` has no `familyId` (deliberate exception to the household-table rule: auth mail precedes any family).

## Consequences

- In production without a provider, verification/reset mail is stored but not delivered. This is logged as a warning and documented; the
  opt-out flag exists for that interim.
- The outbox holds live links, so it must not be exposed: the viewer is disabled in production and rows expire after 7 days.
- Swapping providers touches one file and one switch statement.
