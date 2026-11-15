# Pirate Adventure — The Lost Treasure of Blackbeard Bay

Theme key: `pirate`. Source of truth: `src/game/themes/pirate/`. All numbers below are configuration.

## Chapters

| #   | Key                 | Location          | Status      | Unlock                                              | Completion                                      | Reward                            |
| --- | ------------------- | ----------------- | ----------- | --------------------------------------------------- | ----------------------------------------------- | --------------------------------- |
| 1   | `home-port`         | Home Port         | PLAYABLE    | always                                              | quest `prepare-the-ship`                        | 50 coins, 100 XP, 1 map fragment  |
| 2   | `parrot-island`     | Parrot Island     | PLAYABLE    | Home Port completed **and** 3 × `supply-crate`      | quest `recover-the-compass`                     | 75 coins, 150 XP, 1 map fragment  |
| 3   | `shipwreck-cove`    | Shipwreck Cove    | PLAYABLE    | Parrot Island completed **and** 1 × `ship-explorer` | quest `salvage-the-wreck`                       | 100 coins, 200 XP, 1 map fragment |
| 4   | `skull-reef`        | Skull Reef        | PLAYABLE    | Shipwreck Cove completed **and** 1 × `ship-voyager` | quests `navigate-the-reef`, `defeat-the-kraken` | 125 coins, 250 XP, 1 map fragment |
| 5   | `whispering-jungle` | Whispering Jungle | PLACEHOLDER | Skull Reef completed                                | —                                               | 150 / 300 / 1 fragment            |
| 6   | `treasure-island`   | Treasure Island   | PLACEHOLDER | Whispering Jungle completed **and** 5 map fragments | —                                               | 500 / 1000 / 1 fragment           |

Six chapters → six map fragments. After completing chapters 1 and 2 and claiming both rewards the child
holds two of six (integration-tested).

## Home Port (chapter 1)

Locations: the Captain (NPC), your starter ship (harbor), Quest Board, Supply Shop, Crew Camp,
Lighthouse, Hidden Cove.

- **Main quest `prepare-the-ship`** — objective `collect-supplies`: 3 approved activities (any category),
  each grants 1 `supply-crate`. Quest reward 20 coins / 40 XP. Completing it completes the chapter; the 3
  crates plus the completed chapter unlock Parrot Island ("set sail").
- **Side mission `tidy-the-camp`** — complete one routine → 15 coins, 25 XP, `cosmetic-captain-hat`.
  Optional; never blocks progression.

## Parrot Island (chapter 2)

Locations: Pip the Parrot (NPC), Feather Grove (quest board), Compass Shrine (puzzle), Sunny Beach.

- **Main quest `recover-the-compass`**
  1. `collect-feathers`: 4 approved activities → 4 × `compass-feather`.
  2. `solve-compass-puzzle` (requires objective 1): solve `compass-puzzle`.
     Reward 30 coins / 60 XP / `magic-compass`. Completes the chapter; chapter reward adds the second map
     fragment and Shipwreck Cove unlocks.
- **Puzzle `compass-puzzle`** — type `sequence-match`, symbols N E S W, answer N → E → S → W, hint from Pip.
  Puzzle reward 10 coins / 20 XP.

### Parrot Island scene (feather grove, compass shrine)

Each chapter scene lists its locations. A `quest-board` location with a `questKey` and a `puzzle` location with a `puzzleKey` are links to
`/child/adventure/<chapterKey>/<locationKey>` (ADR 0015); the other kinds stay labels.

- **Feather Grove** shows the quest card for `recover-the-compass` and a row of round slots, one per compass feather (`currentCount` of
  `targetCount` of the `collect-feathers` objective). Only this child's progress is shown; finishing chores fills slots.
- **Compass Shrine** shows "not ready yet" with the first unfinished objective until the feathers are collected, then the puzzle. The browser
  receives only `symbols` and `hint` (the verifier's `toClientView`), never the answer. Wrong attempts get one vague line, never which symbols or
  positions were right.
- **Feedback**: a needle dial spins when the server says "solved" and wobbles on a wrong attempt; a sound toggle (off by default, remembered on
  this device only) plays a short synthesised chime. All of it is CSS/SVG and client-only (ADR 0016) and is switched off by `prefers-reduced-motion`.

## Shipwreck Cove (chapter 3, ADR 0019)

Unlock: Parrot Island completed **and** one `ship-explorer` (150 coins, sold once Parrot Island is completed, so there is no cycle). Buying the
ship re-evaluates unlocks in the same purchase. The map's locked screen names the missing ship. Children who unlocked the cove while it was a
placeholder keep it without the ship (unlocks are never revoked).

Locations: Salvage Yard (quest board for the main quest), Tide Pools (quest board for the side quest), The Wreck (puzzle, gated), Quiet Lagoon.

- **Main quest `salvage-the-wreck`** (50 coins / 100 XP), three objectives that run side by side:
  1. `gather-planks`: 4 approved activities of any category, each grants 1 `salvage-plank`.
  2. `gather-rope`: 3 approved activities of any category, each grants 1 `rope-coil`. A completion feeds the first
     objective that accepts it, so planks fill first and rope next (a household with only plain chores can finish); routine runs count like any other approved activity, as they already did for planks.
  3. `repair-the-ship`: solve `repair-puzzle`.
- **Side mission `tide-pool-treasures`** (15 coins / 25 XP): 2 approved `HELPING` or `PET_CARE` activities. Optional.
- **The Wreck** needs the child to **hold 4 `salvage-plank`** (`requiresItemKey` + `requiresItemQuantity`). Salvage is only held, never spent: there
  is no inventory debit path. The server checks it on every submit under the child lock; the page shows "needs 4 × Salvage Plank (N more)".
- **Puzzle `repair-puzzle`**: type `pair-match`, five damaged parts to five tools (120 possible answers), reward 25 coins / 50 XP. The browser gets parts, tools
  and the hint; tools are listed by key so their order does not follow the answer. Wrong attempts get the same vague line as the compass puzzle.
- Chapter reward 100 coins / 200 XP / 1 map fragment. Completing the chapter does **not** unlock Skull Reef by itself any more: that also needs the voyager ship (below). Achievement **Master Shipwright** (30 coins / 60 XP) is awarded for the repair puzzle (ADR 0020).
- **Economy check** (integration tests): by the time Parrot Island completes a child who bought no cosmetics holds 210 coins (price 150), 285 after
  claiming the Parrot Island reward. After the explorer (135 left), the minimum cove (7 chores) completes with 315 coins and 415 once its reward is claimed:
  the 400-coin voyager is affordable with 15 to spare (ADR 0020).
- Art is placeholder SVG (`salvage-plank`, `rope-coil`, the cove scene) through the manifest.

## Skull Reef (chapter 4, ADR 0020)

Unlock: Shipwreck Cove completed **and** one `ship-voyager` (400 coins, sold once the cove is completed, so there is no cycle). Buying it unlocks the chapter in
the same purchase. The map's locked screen lists what is missing ("Finish shipwreck cove · Need Voyager Ship"). Children whose Skull Reef was already unlocked
(it opened on the cove alone while it was a placeholder) keep it and get their quest rows through the ensure step.

Locations: Quest Board (chart quest), Reef Chart Table (puzzle, gated), Kraken Watch (quest board for the Kraken quest), Tentacle Rocks, Kraken's Lair and
Whirlpool Gate (one Kraken stage each), Coral Shallows (side quest), Bone Wreck (decorative).

- **Main quest `navigate-the-reef`** (40 coins / 80 XP): `collect-chart-pieces` (5 approved activities of any category, each grants 1 `chart-piece`), then
  `chart-the-course` (solve `reef-chart-puzzle`; the table opens only while the child holds the 5 pieces, so no objective chain is needed, as at the wreck).
- **Main quest `defeat-the-kraken`** (60 coins / 120 XP, 1 `kraken-tooth`; `requiresQuestKey: navigate-the-reef`): three `COMPLETE_PUZZLE` objectives, each
  with `requiresObjectiveKey` on the one before: `kraken-tentacles` (`sequence-match`, 10 coins), `kraken-weak-points` (`pair-match`, 15 coins) and
  `kraken-escape` (`route-plan`, 20 coins). No new objective type, no reward path of its own and **no cost**: nothing is spent and no inventory debit exists. A stage
  of the Kraken quest cannot be solved before the chart quest is finished or out of order; the server refuses it and writes no attempt row.
- **Side mission `reef-scavengers`** (20 coins / 30 XP): 2 approved `HYGIENE` or `SCHOOL` activities. Optional.
- **Reef Chart Table** needs the child to hold 5 `chart-piece` (held, never consumed). **Puzzle `reef-chart-puzzle`** (`route-plan`, 5 x 5, 20 coins / 40 XP) and the
  6 x 6 `kraken-escape` board both have a blocked straight route.
- Chapter reward 125 coins / 250 XP / 1 map fragment; both main quests complete the chapter. Whispering Jungle then unlocks as the same empty placeholder.
- Art is placeholder SVG (`chart-piece`, `kraken-tooth`, the reef scene) through the manifest.

## Economy

- Drip: every approved activity while the adventure is active gives 5 coins and 10 XP.
- Level thresholds (XP): 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000.
- Items: resources (`supply-crate`, `compass-feather`, `salvage-plank`, `rope-coil`, `chart-piece`), collectibles (`map-fragment` max 6, `magic-compass`, `kraken-tooth`,
  `gold-doubloon` display-only), ships (`ship-starter` granted at start; explorer 150c, voyager 400c,
  captain 800c, legendary 1500c, each gated by a chapter), upgrades (`upgrade-patched-sail` 40c,
  `upgrade-parrot-perch` 90c, `upgrade-brass-cannon` 200c), cosmetics (`cosmetic-captain-hat` 60c).
  Purchases go through `purchaseItem` (idempotent, never overdraws). The child **Supply shop** (`/child/supplies`) lists every item with a
  `costCoins`, with states _available_, _can't afford_, _locked_ (ship tier / required item / chapter) and _already have the maximum_; the same
  rules are enforced again on the server (ADR 0012). The **Treasure chest** (`/child/inventory`) shows owned items grouped by type, read-only.
- Achievements: Deckhand (1 approved activity), Able Seaman (10), Ship Shape (1 routine), Anchors Aweigh
  (Home Port complete), True North (compass puzzle), Master Shipwright (repair puzzle).

## Art direction (reference)

Polished colourful 3D-cartoon illustration, tropical pirate environments, wooden/parchment UI, big
readable markers, friendly characters, clear distinction between playable locations and decoration. All
current assets are flat-colour placeholders flagged `placeholder: true` in the manifest.

## Home Port scene: design note and status

Phase 4 delivered the supply shop and the treasure chest, and the Home Port slice built the rest (all at `/child/port`, reachable from "More"):
quest board ✅, crew camp ✅ (ADR 0013), lighthouse ✅, Pip dialogue ✅ and hidden cove ✅ (ADR 0014), with placeholder art through the manifest.
Differences from the original note: the lighthouse allows one look per household-local day (`state.lighthouse.lastLookDate`, ADR 0017: the hint appears after the look); the quest board opens a detail dialog per quest (ADR 0018) and the crew camp shows a ship scene;
the cove requires a `map-fragment` and rewards the `cove-pearl` collectible; Pip's line rotates by household-local date and appears on the hub.

- **Quest board.** Read-only list of the chapter's `ACTIVE` quests and their objectives from `getAdventureState` (title, progress `current/target`,
  reward preview). No new tables. A "Quest details" button on each card opens a dialog (loaded on first tap) with the description, every step with its progress, the reward and the location the quest belongs to (linked when that location has a page); progress comes only from the engine (ADR 0018).
- **Crew camp (cosmetic equip/unequip).** Selection lives in `child_adventure_progress.state` as `{ equipped: { head?: itemKey, sail?: itemKey, deck?: itemKey } }`
  validated by a Zod schema in `src/game/schemas`. A service action (`equipCosmetic`) locks the child row, checks the child owns the item and the slot
  matches `config.slot`, then writes the small state. It is never read for rewards or progress; animation state (bobbing, hover) stays in
  client-only Zustand.
- **Lighthouse.** A once-per-day "look out to sea" interaction that surfaces the next unlock hint for the current chapter; the text is read-only
  chapter config (`hint`), the daily limit is the small `lighthouse.lastLookDate` state key written by `lookOutFromLighthouse` (ADR 0017).
- **Hidden cove.** Gated by an achievement or collectible (`requiresItemKey`, reusing ADR 0012 rules); the first visit grants a small one-time
  reward through `grantItem` with a `sourceKey` per child and cove. Needs an ADR before it is built because it adds a reward source.
- **Pip dialogue.** Static, theme-authored lines keyed by situation (`greeting`, `quest-complete`, `low-supplies`), selected by pure functions over engine state.
  No free text, no external services, no child data.
- All artwork continues to go through the asset manifest with placeholders.
