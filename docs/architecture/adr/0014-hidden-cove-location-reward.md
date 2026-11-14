# ADR 0014 — Hidden cove: a one-time location reward granted through `grantItem`

Status: accepted (Phase 4, Home Port)

## Context

The Home Port design note includes a hidden cove: a location that is gated by something the child already holds and, on the first visit,
gives a small one-time reward. This is a new reward source, so it needs the same guarantees as every other one: server-decided, idempotent,
serialized per child, never trusted from the client.

## Decision

- Location data lives in chapter config (`chapterLocationSchema`): optional `requiresItemKey` (the child must currently hold at least one) and
  optional `reward: { itemKey, quantity }` (one-time, items only: no coins or XP, so the ledger is untouched). Nothing pirate-specific is in the
  service; the pirate theme supplies `hidden-cove` → requires `map-fragment`, rewards `cove-pearl` (a collectible, max 1).
- `visitLocation` (`src/server/services/location.service.ts`) is the only writer. It takes `lockChildRow`, re-reads the progress, chapter
  progress (the chapter must not be locked) and the child's inventory under the lock, refuses when the requirement is unmet, then calls
  `grantItem` with `sourceKeys.locationItem(adventureProgressId, chapterKey, locationKey, itemKey)`. The key is unique per child and
  location, so a repeat or racing visit finds the existing grant and grants nothing. "Already found" is derived from the presence of that grant;
  no new table or state is stored.
- `grantItem` gets its own source type, `LOCATION_REWARD` (a one-line enum migration), so history and audits can tell it apart from chapter
  rewards. Existing rows are untouched.
- Because the reward is an item that is clamped by `maxQuantity`, idempotency does not rest on the clamp: the `sourceKey` check comes first,
  and a test races visits to prove exactly one grant row exists.
- No audit entry: this is a child's own gameplay reward, like quest rewards.

## Consequences

- Adding another hidden place is data only (a location with `reward`), plus a page if it needs its own scene.
- The requirement is "currently holds the item", so a consumed requirement item after the first visit does not remove the reward.
- Reward balances (coins, XP, points) are unaffected; only `grantItem` changes inventory.
