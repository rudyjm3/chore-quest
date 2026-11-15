# ADR 0020 — Skull Reef: voyager gate, `route-plan` puzzle and the Kraken as chained puzzle stages

Status: accepted (Phase 5, slice 2)

## Context

Skull Reef (chapter 4) is the next chapter to become playable. It needs:

1. A third ship tier gate, the same shape as the explorer gate in ADR 0019, and an economy that makes it reachable.
2. A navigation puzzle that is not a sequence and not a pairing.
3. A "Kraken challenge" with several stages, without a new objective type and without a real cost (no spending of items).
4. Content for the chapter itself.

Quest/objective chaining (`requiresObjectiveKey`, `requiresQuestKey`), item-hold gates (`requiresItemKey` + `requiresItemQuantity`), the ensure step
and purchases that re-evaluate unlocks already exist (ADR 0014, 0015, 0019). This slice adds data, one puzzle type and one small server rule.

## Decision

### 1. Voyager ship gate and economy

- `skull-reef` unlocks on `CHAPTER_COMPLETED shipwreck-cove` **and** `ITEM ship-voyager ×1`. The voyager (400 coins) was already in the catalogue with
  `requiresChapterKey: shipwreck-cove`, so it is purchasable only once the cove is completed: no cycle. A purchase re-evaluates unlocks in its own
  transaction (ADR 0019), so buying the ship opens the chapter immediately. The locked map screen lists both missing requirements
  ("Finish shipwreck cove · Need Voyager Ship") and the chapter hint names the ship.
- **Grandfathering is unchanged.** Unlocks are never revoked: a child whose Skull Reef was already `UNLOCKED` (the placeholder used to open on the cove
  alone) keeps it without owning the voyager, and the ensure step gives them their quest rows when the chapter gains quests.
- **Economy.** The Parrot Island measurement (285 coins after claiming rewards) leaves 135 after buying the 150-coin explorer. The minimum cove (7 chores)
  then gave 210 (7 × 5 plus the ten-chores achievement 40), quest 40, puzzle 15 and chapter reward 100: **365**, 35 short of 400. Rather than
  change the price (documented in several places as 400) the cove pays a little more, all in theme data:

  | Reward                              | Before | After |
  | ----------------------------------- | -----: | ----: |
  | Main quest `salvage-the-wreck`      |     40 |    50 |
  | Puzzle `repair-puzzle`              |     15 |    25 |
  | New achievement "Master Shipwright" |      – |    30 |
  | Chapter reward (unchanged)          |    100 |   100 |

  Result: 315 coins when the cove is completed (reward not yet claimed) and **415** once its reward is claimed, so the voyager is affordable with
  15 to spare even when the optional side quest is skipped (+15 if played). The child has to claim the chapter reward first, the same loop as before.
  An integration test asserts these exact numbers, so a later change fails a test instead of stranding a child. Children who already claimed
  cove rewards keep what they were paid; the achievement is awarded when the repair puzzle is next completed, so it only reaches children who have not solved it yet.

- **Rope filter.** Dropped in PR #12 (not part of this slice): planks fill first under the first-match rule, so a category filter on rope never added variety
  and only caused a dead end.

### 2. The `route-plan` puzzle type

- New verifier `src/game/puzzles/route-plan.ts`. Config: `width` and `height` (3 to 8), `start` and `goal` cells, `reefs` (cells), optional `hint`.
  Cells are `{ x, y }` with `(0, 0)` top-left. No path is stored anywhere: **there is no stored answer, only a layout**.
- Answer: `{ moves: ("up" | "down" | "left" | "right")[] }`, at most 64 moves. It is correct when, starting from `start`, every move stays inside the
  board, never lands on a reef, and the ship ends on `goal`. Anything else (empty, partial, off the board, onto a reef, a diagonal or unknown direction,
  extra fields of the wrong type) is "not correct". Moves are applied by rule, so **several different valid routes are accepted**; revisiting a cell is
  legal (a wandering route still gets there) and passing through the goal and coming back is fine as long as the last cell is the goal.
- `parseConfig` rejects unusable layouts: out-of-bounds or duplicate cells, `start` equal to `goal`, a reef on the start or the goal, and a layout with no
  safe route (a breadth-first search at parse time). The search result is thrown away; it is never stored or sent.
- **Reefs are visible.** The decision: this is a planning puzzle, so `toClientView` returns the board size, `start`, `goal`, `reefs` (sorted row by row so
  list order says nothing) and the hint. Hiding reefs would force the child to discover them by failing, which with stored attempt rows and a vague verdict
  is both leaky (each attempt reveals a cell) and unfriendly. The answer is the _path_, and the path is in neither the config nor the view. A unit test checks
  the view equals exactly `{ width, height, start, goal, reefs, hint }`.
- The board UI simulates moves client side from the view only (it is a convenience: it refuses a move off the board or onto a reef with a message).
  The server re-verifies the whole path; nothing in the browser is trusted.
- Feedback stays the same vague, theme-neutral line as the other puzzles.
- Failed attempts are stored one row each as before; attempt limits stay deferred to Phase 6 edge rate limiting. With visible reefs the answer space is not
  a secret, so this adds no new guessing risk.

### 3. The Kraken: three chained puzzle stages, no cost

- Two main quests in Skull Reef: `navigate-the-reef` (chart pieces from approved chores, then the `route-plan` puzzle `reef-chart-puzzle`) and
  `defeat-the-kraken` (`requiresQuestKey: navigate-the-reef`). The Kraken quest has one `COMPLETE_PUZZLE` objective per stage, each with
  `requiresObjectiveKey` on the previous one: `kraken-tentacles` (a `sequence-match`), `kraken-weak-points` (a `pair-match`) and `kraken-escape`
  (a `route-plan`). **No new objective type, no new reward path**: stage rewards are the existing per-puzzle bundles, the quest and chapter bundles do
  the rest, all through `grantRewardBundle` with its source keys.
- **No real cost.** Defeating the Kraken is solving three puzzles in order. Nothing is spent, no inventory debit exists, and none is added. If a later
  design wants to spend items to win (cannon shots, say), that needs its own ADR for an inventory debit path first; it was deliberately not built here.
- **A server rule the old gate lacked.** `puzzleObjectiveGate` only looked at quests that are `ACTIVE`; a puzzle not tied to any active objective was
  playable "with no quest progress". That was harmless while every puzzle quest was active from chapter unlock, but a stage of a quest that is still
  _locked_ behind `requiresQuestKey` could be solved early: it would pay its reward, be marked solved for good, and never advance its objective, leaving
  the quest unfinishable. The gate now also looks at the chapter's definitions: if the puzzle is the target of a `COMPLETE_PUZZLE` objective whose quest is
  not active and not finished, the attempt is refused (`invalidState`, no attempt row). Covered by a test that submits a stage of the locked Kraken quest.
- The ordering of stages is enforced on the server by the existing `requiresObjectiveKey` check; the UI only mirrors it (`available`/"waiting for").
- The chapter completes when both main quests are done (`requiresQuestKeys`); the side quest is optional. Whispering Jungle still unlocks on
  `CHAPTER_COMPLETED skull-reef` as the same empty placeholder; no content there.

### 4. Items, locations and gates

- New items: `chart-piece` (RESOURCE, five approved chores of any kind, like planks) and `kraken-tooth` (COLLECTIBLE, the Kraken quest's item reward).
  The reef chart location is gated with `requiresItemKey: chart-piece` + `requiresItemQuantity: 5`: held, never consumed (ADR 0019).
- Locations: Reef Chart Table (`route-plan` puzzle, gated), Tentacle Rocks, Kraken's Lair and Whirlpool Gate (one puzzle each, the three Kraken stages),
  Captain's Quest Board (main quests), Coral Shallows (side quest) and a decorative wreck. One location shows one puzzle, so the Kraken's lair is three
  places in the scene rather than a new multi-puzzle location kind; that would be a new config key for no new capability.
- Side quest `reef-scavengers`: two approved hygiene or school chores. Optional; a household without them still finishes the chapter.
- Art: placeholder SVGs and manifest entries (`scene.skull-reef`, `item.chart-piece`, `item.kraken-tooth`); components never hard-code paths.

## Consequences

- Chapter 4 needs no new engine code beyond the puzzle type and the locked-quest rule. The `route-plan` type is reusable (Whispering Jungle could use a
  bigger board) and theme-neutral: it speaks of cells, reefs and moves only in theme data.
- The cove pays more than before for children who have not finished it; the numbers are in the build health report and asserted by a test.
- The extra quest rows for chapter 4 reach grandfathered children through the ensure step with no migration. `defeat-the-kraken` gets its rows when
  `navigate-the-reef` is claimed (`evaluateQuestCompletion` activates quests that require it).
- A child can solve the three Kraken stages only after finishing the chart quest; solving stage 3 before stage 2 is refused by `requiresObjectiveKey`.
- Limitations: tap-based route UI (arrow buttons, no drag), no attempt limits, placeholder art, and the Kraken has no cost or fail state by design.
