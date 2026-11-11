# ADR 0006 — Adventure content as validated JSON configuration

**Status:** accepted · **Date:** 2026-11-10

## Context

The platform must support multiple themes (pirate, space, fantasy) without rebuilding the task backend,
and "three crates to set sail" must not be a hard-coded rule.

## Decision

Adventures are authored in TypeScript (`src/game/themes/<theme>`) as `AdventureDefinition`s validated by
Zod, seeded into definition tables whose `config` JSON columns are parsed through the same schemas at
runtime. The engine (`src/game/engine`) evaluates generic objective eligibility, counters, unlock
requirements and chapter completion. Artwork is referenced through asset manifests.

## Consequences

- New theme = new folder + assets + seed; no service changes.
- Config schema changes must stay backward compatible or ship with a data migration.
- Placeholder chapters exist as data with `status = PLACEHOLDER` and unlock rules only.
