# ADR 0019 — Shipwreck Cove: ship gate, `pair-match` puzzle, item-hold gating and an idempotent ensure step

Status: accepted (Phase 5, slice 1)

## Context

Shipwreck Cove (chapter 3) is the first chapter after Parrot Island to become playable. It brings four things the engine does not do yet:

1. **The chapter needs a ship, not only a finished chapter.** The only unlock requirements used so far were satisfied by the same pipeline run that
   completes the previous chapter (supply crates are granted by the quest objective). A ship is bought in the shop, and a purchase does not
   re-evaluate chapter unlocks, so a child who buys the ship after finishing Parrot Island would stay locked out until some unrelated event
   happened to call `unlockEligibleChapters`.
2. **A second puzzle type.** Repairing the wreck is "match each damaged part to the right tool", which is not a sequence.
3. **A location that opens only while the child holds enough salvage**, with the salvage kept (not spent). ADR 0014's `requiresItemKey` is "at least
   one" and is only enforced for locations with a one-time `reward`; a puzzle location had no server-side gate at all.
4. **Existing households.** Children whose chapter 3 was already unlocked (a placeholder with no quests) have no `quest_progress` rows for the
   quests this slice adds. Quest progress rows are created when a chapter unlocks, which has already happened for them.

## Decision

### Ship gate and grandfathering

- `shipwreck-cove` unlocks on `CHAPTER_COMPLETED parrot-island` **and** `ITEM ship-explorer ×1` (declared in chapter config, nothing in the engine).
  The explorer costs 150 coins and is purchasable once Parrot Island is completed (`requiresChapterKey`), so the two requirements cannot form a cycle.
  The locked map screen already reads `missingRequirements`; it now shows the item's display name (state carries a name map) instead of a key.
- **Unlocks are never revoked.** A child whose chapter 3 is already `UNLOCKED` keeps it without owning the ship. Only `LOCKED` chapters are evaluated.
- **A purchase re-evaluates unlocks, in the same transaction.** `purchaseItem` calls `unlockEligibleChapters` for the item's adventure after
  the grant. To do that without a cycle (`adventure.service` already imports `inventory.service`), the chapter unlock/activation code
  (`unlockEligibleChapters`, `activateQuest`, snapshot building and the ensure step below) moves out of `adventure.service.ts` into
  `chapter-unlock.service.ts`, which reads inventory itself and imports neither of the two. No behaviour change for existing callers.
- **Economy.** Five coins per approved chore plus quest, puzzle and chapter rewards must make 150 coins reachable by the end of Parrot Island without
  buying any cosmetic. The numbers are asserted by an integration test (`shipwreck-cove.test.ts`) and documented in the build health report; if
  they ever drift below the price, that test fails rather than a child getting stuck.

### The `pair-match` puzzle type

- New verifier in `src/game/puzzles/pair-match.ts`. Config: `parts` and `tools` (each `{ key, label }`, the same count, 2 to 8), `pairs` (part key → tool key,
  the answer, a one-to-one mapping), optional `hint`. Five parts have 5! = 120 possible answers.
- Answer: `{ pairs: { [partKey]: toolKey } }`. It is correct only when every part is assigned the right tool. Missing, extra, unknown or duplicated
  entries are simply "not correct"; the feedback is the same vague, theme-neutral line as `sequence-match`, never which pairs were right.
- `toClientView` returns `parts` and `tools` (labels and keys) and the hint, never `pairs`. Tools are listed sorted by key, so list order cannot
  hint at the answer; a unit test checks the stored answer is absent from the view and that the pirate puzzle's tool order is not its solution order.
- The submit action carries the answer as one JSON field (size limited) in addition to the existing `sequence` fields; the verifier validates the shape.
- Failed attempts are still stored one row each with no limit (ADR 0015). Attempt limits stay deferred and belong with Phase 6 edge rate limiting.

### Gating without consuming items

- `chapterLocationSchema` gets `requiresItemQuantity` (integer, default 1) next to `requiresItemKey`: "the child currently holds at least N of this item".
  Salvage is **not consumed**: there is no inventory debit path and none is added. The gate only reads the balance.
- The gate is enforced on the server for puzzle locations: `submitPuzzleAnswer` finds the chapter's locations that point at the puzzle, and when one
  has `requiresItemKey`, refuses the attempt (`invalidState`, no attempt row written) unless the child holds the quantity, evaluated under the child lock.
  A pure helper in `src/game/engine` decides; the page and `getPuzzleForChild` only display the same result. A puzzle already solved stays solved.
- `visitLocation` (reward locations, ADR 0014) uses the same quantity check, so `requiresItemQuantity` means one thing everywhere.

### Ensure step (not a data migration)

- `ensureChapterProgress(tx, ...)` in `chapter-unlock.service.ts`, run with the child lock held: for every chapter the child has reached (`UNLOCKED`
  or `COMPLETED`), create any missing `quest_progress` row for a quest without `requiresQuestKey` (or whose prerequisite quest is done) as `ACTIVE`, and create
  any missing `objective_progress` rows for quests that are `ACTIVE`. It never touches rows that exist, never reopens a `CLAIMED` quest and never
  creates rows for `LOCKED` chapters. Everything is `createMany({ skipDuplicates })` or a check first, so it is safe to run repeatedly and in parallel
  (the lock serialises it).
- It runs at the end of every unlock evaluation (start, chapter completion, reward claim, purchase), at the start of `applyCompletionToQuests`, and in
  `submitPuzzleAnswer`. Chapter pages call a small service that does a lock-free read and only takes the lock and writes when something is missing,
  so a grandfathered child sees the new quests as active the first time they open the chapter.
- Why not a migration: quest definitions are theme data that change by re-seeding, not by schema migration, and a data migration would run once in one
  database while the same drift can appear whenever theme data grows (chapters 4 to 6 next). The ensure step makes "theme data grew" a normal case.

## Consequences

- Chapter 4 and later need no new engine code for item-gated unlocks; a purchase is enough.
- `requiresItemQuantity` is a new config key (documented in `docs/gameplay/GAME_ENGINE.md`); older config without it behaves as before (quantity 1).
- The ensure step adds a few reads to each approval for children with unlocked chapters. They are indexed by `childId`; measured in the build health report.
- A child who owns the explorer ship but was already past chapter 3 is unaffected; one who has not bought it and is still `LOCKED` needs it.
- Salvage that is only held, never spent, means the quantity gate is satisfied for good once earned. That is intended (the first thing to
  reconsider if a later chapter needs a real cost is a separate ADR for an inventory debit path).
- The rigging objective needs chores in the `HYGIENE`, `SCHOOL` or `PET_CARE` categories. A household that has none of those would stall the quest
  (not the puzzle). This is noted in `docs/NEXT_STEPS.md` rather than solved with a parent-facing setting in this slice.
