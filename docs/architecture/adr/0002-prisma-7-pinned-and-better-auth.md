# ADR 0002 — Prisma 7.10 (pinned) with the pg driver adapter, Better Auth for parents

**Status:** accepted · **Date:** 2026-11-10

## Context

At build time the `prisma` npm `latest` tag pointed at an 8.0 release candidate while `@prisma/client`
latest was 7.10.1. Better Auth's Prisma adapter supports Prisma 5–7 and explicitly not 8 yet.

## Decision

Pin `prisma`, `@prisma/client`, `@prisma/adapter-pg` to 7.10.1. Use the Prisma 7 conventions:
`prisma.config.ts` holds the datasource URL and seed command; the `prisma-client` generator emits
TypeScript into `src/generated/prisma` (git-ignored); the client is constructed with `PrismaPg`.
Use Better Auth 1.7 (email + password, Prisma adapter, `nextCookies` plugin) for parents only; children use
family-managed sessions (ADR 0004).

## Consequences

- Upgrading to Prisma 8 waits for Better Auth adapter support; track better-auth issue #9636.
- The generated client is git-ignored, so `postinstall` runs `prisma generate` (no database needed:
  `prisma.config.ts` falls back to an empty URL). This covers fresh clones, CI and Vercel builds.
- Better Auth tables use `gen_random_uuid()` defaults; the schema text says `gen_random_uuid()` (not
  `pg_catalog.gen_random_uuid()`) so `migrate diff` reports no drift.
