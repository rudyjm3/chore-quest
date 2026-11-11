# ADR 0004 — Family-managed child sessions instead of child user accounts

**Status:** accepted · **Date:** 2026-11-10

## Context

Children, often under 13, must use the app without collecting personal data, and a parent session must
never implicitly grant child-only actions (or vice versa).

## Decision

Children are `child` rows owned by a family. Access is via family code + parent-set PIN or parent device
hand-over, producing a separate opaque-token session (`child_session`, HMAC-hashed token, own cookie).
See `docs/architecture/CHILD_AUTHENTICATION.md`.

## Consequences

- No child emails/passwords; minimal data (display name, optional birth year).
- Two context types in code; two cookie names; two layout gates.
- Lockout and uniform errors mitigate PIN guessing; edge rate limiting is a Phase 6 item.
