# ADR 0017 — Lighthouse: one look per household-local day, stored as a small state key

Status: accepted (Phase 4, Home Port polish)

## Context

The Home Port design note called the lighthouse a once-per-day "look out to sea", but it shipped repeatable with no state
(ADR 0013 left room in `child_adventure_progress.state` for small flags). The hint text is spoiler-free and static, so there is nothing to
protect with the limit: it is a daily ritual that nudges the child to come back, not a reward gate. Even so, the decision of "has this child
already looked today" must be made by the server, not by the browser, and must not corrupt the state other features keep there (the equipped
cosmetics).

## Decision

- Add one optional key to the Zod state schema: `lighthouse: { lastLookDate: "YYYY-MM-DD" }`. A malformed value is dropped on its own
  (`.catch`) and never resets the equipped cosmetics next to it. Unknown keys are still preserved (ADR 0013).
- `lookOutFromLighthouse` (in `location.service.ts`, the only writer) takes `lockChildRow`, re-reads the progress row under the lock, computes
  "today" in the household's timezone with `todayIn`, and writes `lastLookDate` only when it differs. A second or racing look the same day changes
  nothing and reports `newlyLooked: false`. It merges into the existing state object, so `equipped` and unknown keys survive. The service takes an
  optional `now` so tests can fake the clock.
- The page shows the hint only after a look today (the server renders it from `lastLookDate`); the hint itself is unchanged
  (`lighthouseHint` over chapter config). No ledger, no inventory, no audit entry: nothing of value is granted.
- No new table or env var. Resetting the key costs nothing but one extra look.

## Consequences

- The limit is per household-local calendar day, so a family timezone change can allow one extra look; that is harmless.
- Both `equipCosmetic` and `lookOutFromLighthouse` read-modify-write the same JSON under the child lock, so they serialise; a test races them and
  asserts both keys survive.
