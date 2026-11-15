# Game engine

The adventure engine is theme-independent. It knows about **adventures, chapters, quests, objectives,
puzzles, items and rewards**, and it consumes **verified completions** from the family system. Nothing in
`src/game/engine`, `src/game/schemas` or `src/server/services/adventure.service.ts` mentions pirates.

## Building blocks

| Concept             | Definition table                                                                                                      | Progress table                                                              | Authored in                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------- |
| Adventure (theme)   | `adventure` (`config`: per-activity drip rewards, starter items, level thresholds)                                    | `child_adventure_progress`                                                  | `src/game/themes/<theme>/adventure.ts` |
| Chapter             | `adventure_chapter` (`config`: unlock, completion, rewards, map marker, locations, scene asset)                       | `child_chapter_progress` (LOCKED → UNLOCKED → COMPLETED, `rewardClaimedAt`) | same                                   |
| Quest (MAIN / SIDE) | `adventure_quest` (`config`: rewards, `requiresQuestKey`)                                                             | `quest_progress` (LOCKED → ACTIVE → COMPLETED/CLAIMED)                      | same                                   |
| Objective           | `quest_objective` (`type`, `targetCount`, `config`: eligibility, `grantItemKey`, `puzzleKey`, `requiresObjectiveKey`) | `objective_progress` + `quest_contribution`                                 | same                                   |
| Puzzle              | `puzzle_definition` (`type`, `config.data`, `config.rewards`)                                                         | `puzzle_attempt`                                                            | same + verifier in `src/game/puzzles`  |
| Item                | `item_definition` (`type`: RESOURCE, COLLECTIBLE, COSMETIC, SHIP, SHIP_UPGRADE, CONSUMABLE; `maxQuantity`; `config`)  | `child_inventory_item` + `inventory_grant`                                  | `items.ts`                             |
| Achievement         | `achievement_definition` (`criteria`)                                                                                 | `earned_achievement`                                                        | `achievements.ts`                      |

All `config` JSON is validated by the Zod schemas in `src/game/schemas/chapter-config.ts` both at seed
time and when loaded.

## Objective types

| Type                                        | Progress source                                                                       | Notes                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `APPROVED_ACTIVITIES`                       | Any verified completion matching `eligibility.sourceTypes` / `eligibility.categories` | Optional `grantItemKey` × `grantQuantity` per unit of progress (supply crates, feathers) |
| `COMPLETE_ROUTINES`                         | Verified routine runs                                                                 |                                                                                          |
| `COMPLETE_PUZZLE`                           | `submitPuzzleAnswer` success for `config.puzzleKey`                                   | Gated by `requiresObjectiveKey`                                                          |
| `COLLECT_ITEMS`, `VISIT_LOCATION`, `CUSTOM` | Reserved; schema-supported, no evaluator yet                                          | Phase 4/5                                                                                |

One completion contributes to at most one objective per quest, and at most once per objective
(`quest_contribution` uniqueness).

## Unlock and completion rules

Unlock requirements (any combination, all must hold): `ALWAYS`, `CHAPTER_COMPLETED {chapterKey}`,
`ITEM {itemKey, quantity}`, `QUEST_COMPLETED {chapterKey, questKey}`. Completion requires every quest in
`completion.requiresQuestKeys` to be complete; `PLACEHOLDER` chapters never complete.

Evaluation points (`adventure.service.ts`):

1. `startAdventure` → chapter rows created, `unlockEligibleChapters`, starter items granted.
2. Pipeline `applyCompletionToQuests` → objective counters, item grants → `evaluateQuestCompletion`
   (quest rewards, dependent quests) → `evaluateChapterCompletion` → `unlockEligibleChapters`.
3. `submitPuzzleAnswer` → attempt, puzzle rewards, puzzle objective → quest/chapter evaluation.
4. `claimChapterReward` (explicit, child-initiated, once) → chapter reward bundle → `unlockEligibleChapters`
   (because chapter rewards can satisfy `ITEM` requirements of later chapters).

## Rewards

A `RewardBundle` is `{ coins, xp, items[] }`. Coins/XP are ledger entries (`reward_ledger_entry`,
currencies COINS / XP) and items are `inventory_grant`s; both are idempotent via `sourceKey`
(`src/lib/utils/source-keys.ts`). Parent POINTS are never touched by the engine.

Per-activity drip (`adventure.config.perActivity`) is credited by the pipeline only while the child has
an ACTIVE adventure. Levels derive from XP via `config.levelThresholds` (`levelForXp`).

## Achievements and the child gallery

`achievementDefinitionSchema` (per theme) has an optional `hint`: a spoiler-free nudge stored in `achievement_definition.hint`. The child
gallery (`achievement.service`) shows the hint while an achievement is locked and only reveals its `description` once earned; `criteria` is
never sent to the client. Without a `hint` the generic "Keep going…" text is used. Services, schema and shared components stay theme-neutral;
the pirate wording lives in `src/game/themes/pirate/achievements.ts`.

## Home Port keys (chapter data)

- `chapterConfig.hint` — spoiler-free nudge shown by the lighthouse (`lighthouseHint`: hint of the furthest playable chapter, else the next locked one).
- `chapterConfig.locations[].requiresItemQuantity` (integer ≥ 1, default 1) — with `requiresItemKey`, the child must currently hold at least this many. Held, never consumed (ADR 0019). Enforced for `reward` locations by `visitLocation` and for `puzzle` locations by `submitPuzzleAnswer` (pure helpers in `src/game/engine/location-gate.ts`); `getPuzzleForChild` returns `gate: { itemKey, quantity, met }` for display.
- `chapterConfig.locations[].requiresItems` (array of `{ itemKey, quantity ≥ 1 }`, default empty, ADR 0021) — more items the child must hold **at the same time**; together with `requiresItemKey`/`requiresItemQuantity` every one must be satisfied (the largest quantity wins when an item is listed twice, and across several locations that open the same puzzle). Held, never consumed. Enforced by the server in `submitPuzzleAnswer` and `visitLocation`.
- `chapterConfig.locations[].requiresItemKey` and `.reward` — a place the child must hold an item for, with a one-time item reward on first visit (`location.service`, ADR 0014). Item rewards only; the key is per child and place.
- Item `config.slot` — the slot a wearable item fits (`head`, `sail`, `deck`, ...). The crew camp stores `{ equipped: { slot: itemKey } }` in `child_adventure_progress.state` (ADR 0013); slots are an open vocabulary defined by item data.
- NPC dialogue (`npcDialogueSchema`, `src/game/schemas/dialogue.ts`): lines per situation (`greeting`, `quest-complete`, `low-supplies`) plus `lowSupplies: { itemKey, below }`. `selectLine` is pure and picks by situation and a day seed; no free text and no child data.

## Puzzles

Every `PuzzleVerifier` also implements `toClientView(config)`: the only part of the stored config that may reach the browser (for
`sequence-match`, `symbols` and `hint`, never `sequence`). Pages use `getPuzzleForChild`, never the raw `puzzle_definition.config` (ADR 0015).
Verifier feedback is theme-neutral and never says how close an attempt was.

A puzzle `type` maps to a `PuzzleVerifier` in `src/game/puzzles/registry.ts`. The client submits an
answer; the server parses the stored config and verifies. Completed attempts are unique per child/puzzle
(partial index). Current types:

- `sequence-match` (`{ symbols, sequence, hint }`). Client view: `symbols`, `hint`. Answer `{ sequence: string[] }`.
- `pair-match` (`{ parts: [{key,label}], tools: [{key,label}], pairs: { partKey: toolKey }, hint }`, ADR 0019): match every part to its tool, one
  tool per part, 2 to 8 parts (five parts = 120 answers). Client view: `parts`, `tools` (sorted by key) and `hint`, never `pairs`. Answer
  `{ pairs: { partKey: toolKey } }`; anything incomplete, duplicated, unknown or malformed is simply "not correct". `parseConfig` rejects a config whose parts, in
  the listed order, would line up with the sorted tools (that order would spell out the answer).

- `route-plan` (`{ width, height, start: {x,y}, goal: {x,y}, reefs: [{x,y}], hint }`, 3 to 8 cells a side, ADR 0020): plan a route of moves across a small grid from the start to
  the goal without leaving the board or touching a hazard. Answer `{ moves: ("up"|"down"|"left"|"right")[] }` (at most 64). The verifier applies the moves by rule
  (in bounds, no reef, ends on the goal), so **any safe route is accepted**; revisiting a cell is legal. No route is stored. `parseConfig` rejects out-of-bounds or duplicate
  cells, a start equal to the goal, a hazard on either, and a board with no safe route (breadth-first search at parse time). Client view: the whole board (`width`, `height`,
  `start`, `goal`, `reefs` sorted row by row, `hint`): it is a planning puzzle, so hazards are visible, and the answer is the child's route, never in the view. The browser simulates moves
  with the pure `stepOnBoard` helper only to refuse impossible steps politely; the server re-verifies the whole route.

- `clue-order` (`{ items: [{key,label}], clues: [{ rule, a, b | slot, text }], hint }`, 3 to 6 items, ADR 0021): put the items in numbered places using clues. Rules: `left-of`, `next-to`,
  `not-next-to` (two items), `in-slot`, `not-in-slot` (one item and a place from 1). Answer `{ order: string[] }` (item keys, place 1 first). No answer is stored: `parseConfig` enumerates every
  ordering (at most 720) and **rejects a config with zero or several solutions**, so "satisfies every clue" is "is the answer". It also rejects unknown items or places, a clue comparing an item with itself, duplicate
  keys, and keys whose sorted order is the solution. Client view: `items` (sorted by key), `slots`, `clues` (the sentences only) and `hint`. The sentence of a clue is theme data and is checked by hand against its rule.

The submit action sends `sequence-match` answers as repeated `sequence` fields and other types as one JSON `answerJson` field (2000 characters at most);
the verifier validates the shape.

## Chained quests and puzzle stages (ADR 0020)

A multi-stage challenge needs no engine type: one quest with a `COMPLETE_PUZZLE` objective per stage, each with `requiresObjectiveKey` on the previous one, optionally behind
another quest (`config.requiresQuestKey`, activated when that quest is claimed). Order is enforced on the server in `submitPuzzleAnswer` (`puzzleObjectiveGate`): a stage
is refused (`invalidState`, no attempt row) while its prerequisite objective is open **or while its quest has not started or finished**. The second rule exists because a
puzzle that belongs to no ACTIVE quest used to be playable "with no progress", which would have paid out and been marked solved for good while its objective stayed open.
Puzzles that belong to no quest objective at all are still playable. Rewards for each stage, the quest and the chapter use the existing bundles; nothing is spent.

## Unlocking, ensure step and item gates (ADR 0019)

- A chapter unlocks when all `unlock.requires` hold (`CHAPTER_COMPLETED`, `ITEM`, `QUEST_COMPLETED`). `unlockEligibleChapters` runs after a quest or chapter
  completion, a reward claim, enrolment **and any purchase** (so an item requirement such as the explorer ship unlocks at the moment of buying). It only looks at
  `LOCKED` chapters, so unlocks are never revoked when requirements change later.
- **Ensure step** (`ensureChapterProgress`, `src/server/services/chapter-unlock.service.ts`): for every chapter the child has reached, create the missing
  `quest_progress` rows (a quest without `requiresQuestKey`, or whose prerequisite quest is done) as ACTIVE and the missing `objective_progress` rows of ACTIVE quests.
  It never changes an existing row, never reopens a CLAIMED quest and never touches LOCKED chapters. It runs at the end of every unlock evaluation, at the start of
  `applyCompletionToQuests`, in `submitPuzzleAnswer`, and from the chapter pages (a lock-free look first; the lock and the write happen only when something is missing).
  This is how theme data can grow (a placeholder chapter gaining quests) without a data migration.

## Rendering

- `AdventureMap` renders a manifest background plus `MapMarker`s at percent positions with data-driven
  state (`locked | unlocked | current | completed`).
- Chapter scenes render manifest artwork plus `locations` hotspots (`quest-board`, `shop`, `npc`, `puzzle`, …).
- Asset manifests (`src/game/schemas/asset-manifest.ts`) describe id, path, type, theme, chapter, size,
  optional position/animation and a `placeholder` flag. Components never hard-code paths.
- Animation/UI state stays in the client-only Zustand scene store (`src/features/adventures/scene-store.ts`, ADR 0016) and never reaches the database; persistent state is only what the
  services write.

## Adding a theme

1. Create `src/game/themes/<theme>/{adventure,items,achievements,manifest,index}.ts` and register it in
   `src/game/themes/index.ts`.
2. Add artwork under `public/assets/adventures/<theme>/` and list it in the manifest.
3. Run `pnpm db:seed` (idempotent upserts by key).
4. No changes to services, schema or shared components should be necessary; if they are, the engine is
   missing a generic capability — add it generically.
