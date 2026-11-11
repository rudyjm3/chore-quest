# ADR 0003 — Cache Components (PPR) disabled for the foundation

**Status:** accepted · **Date:** 2026-11-10

## Context

`create-next-app@16.4` scaffolds `cacheComponents: true` + `partialPrefetching: true`. With it, every
request-bound read (cookies, session, database) must sit behind Suspense or use `use cache: private`,
and `runtime` segment config is unsupported.

## Decision

Set `cacheComponents: false`. All authenticated pages are fully dynamic server renders. Mutations use
server actions + `revalidatePath`.

## Consequences

- Simpler mental model for the foundation; no static-shell work yet.
- Revisit in Phase 4/6 for the child map and marketing pages, following
  `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md`.
