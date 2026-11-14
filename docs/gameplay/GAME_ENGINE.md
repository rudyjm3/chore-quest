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
- `chapterConfig.locations[].requiresItemKey` and `.reward` — a place the child must hold an item for, with a one-time item reward on first visit (`location.service`, ADR 0014). Item rewards only; the key is per child and place.
- Item `config.slot` — the slot a wearable item fits (`head`, `sail`, `deck`, ...). The crew camp stores `{ equipped: { slot: itemKey } }` in `child_adventure_progress.state` (ADR 0013); slots are an open vocabulary defined by item data.
- NPC dialogue (`npcDialogueSchema`, `src/game/schemas/dialogue.ts`): lines per situation (`greeting`, `quest-complete`, `low-supplies`) plus `lowSupplies: { itemKey, below }`. `selectLine` is pure and picks by situation and a day seed; no free text and no child data.

## Puzzles

Every `PuzzleVerifier` also implements `toClientView(config)`: the only part of the stored config that may reach the browser (for
`sequence-match`, `symbols` and `hint`, never `sequence`). Pages use `getPuzzleForChild`, never the raw `puzzle_definition.config` (ADR 0015).
Verifier feedback is theme-neutral and never says how close an attempt was.

A puzzle `type` maps to a `PuzzleVerifier` in `src/game/puzzles/registry.ts`. The client submits an
answer; the server parses the stored config and verifies. Completed attempts are unique per child/puzzle
(partial index). Current type: `sequence-match` (`{ symbols, sequence, hint }`).

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
