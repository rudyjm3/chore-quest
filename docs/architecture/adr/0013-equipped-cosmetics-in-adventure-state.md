# ADR 0013 — Equipped cosmetics live in `child_adventure_progress.state`, written by one locked service action

Status: accepted (Phase 4, Home Port crew camp)

## Context

The Home Port crew camp lets a child wear cosmetics they already own (head, sail, deck, ...). The schema already reserves
`child_adventure_progress.state` (JSON, default `{}`) for "small persisted game state, never authoritative for rewards". A new table would
add a migration, a `familyId` index and cascade rules for a few strings.

## Decision

- Selection is stored as `{ equipped: { <slot>: <itemKey> } }` in `child_adventure_progress.state`, validated by `adventureStateSchema` in
  `src/game/schemas/adventure-state.ts`. The schema is theme-neutral (slot and item keys are plain strings), tolerant of unknown keys so later
  flags can share the object, and a read falls back to `{ equipped: {} }` when stored JSON does not parse.
- `equipCosmetic` (`src/server/services/crew-camp.service.ts`) is the only writer. It takes `lockChildRow` first, re-reads the progress row
  under the lock, then checks (a) the item exists and is active, (b) the child owns it (`quantity > 0` for this `childId` and `familyId`),
  (c) the requested slot equals the item's `config.slot`. Unequip sets the slot to `null`. A read-modify-write without the lock would lose a
  concurrent equip of another slot, so the lock matters even though no reward is involved.
- Ownership is re-checked on every read: an equipped key the child no longer owns is simply not shown as worn. Nothing reads `state` for
  rewards, unlocks or progress. Animation state (bobbing, hover) stays in client-only Zustand and is never persisted.
- No audit entry: this is a child's own cosmetic choice with no reward, approval or credential effect.

## Consequences

- No migration and no new table. A future need to query "who wears X" would require a migration and a backfill from the JSON.
- The slot vocabulary comes from item data (`config.slot`), so a new theme can add slots without code changes.
