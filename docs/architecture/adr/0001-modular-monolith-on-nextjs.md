# ADR 0001 — Modular monolith on Next.js

**Status:** accepted · **Date:** 2026-11-10

## Context

Chore Quests combines a family management application and an adventure engine. Both must evolve
quickly, share identity and data, and be deployable by a small team on Vercel + managed PostgreSQL.

## Decision

One Next.js 16 application with strict internal boundaries (routes → features → services → lib; a pure
game engine consuming verified completion events) and one PostgreSQL database. No microservices, no
message broker. Durability of cross-module effects comes from transactions plus idempotent, resumable
pipeline steps keyed by database uniqueness.

## Consequences

- Simple local setup and deployment; integration tests can exercise the whole pipeline.
- Boundaries are enforced by convention and review (see AGENTS.md), not by the network.
- If the adventure engine later needs isolation, `ActivityCompletion` is already the only contract between
  the two systems.
