# Pirate Adventure — The Lost Treasure of Blackbeard Bay

Theme key: `pirate`. Source of truth: `src/game/themes/pirate/`. All numbers below are configuration.

## Chapters

| #   | Key                 | Location          | Status      | Unlock                                              | Completion                  | Reward                           |
| --- | ------------------- | ----------------- | ----------- | --------------------------------------------------- | --------------------------- | -------------------------------- |
| 1   | `home-port`         | Home Port         | PLAYABLE    | always                                              | quest `prepare-the-ship`    | 50 coins, 100 XP, 1 map fragment |
| 2   | `parrot-island`     | Parrot Island     | PLAYABLE    | Home Port completed **and** 3 × `supply-crate`      | quest `recover-the-compass` | 75 coins, 150 XP, 1 map fragment |
| 3   | `shipwreck-cove`    | Shipwreck Cove    | PLACEHOLDER | Parrot Island completed                             | —                           | 100 / 200 / 1 fragment           |
| 4   | `skull-reef`        | Skull Reef        | PLACEHOLDER | Shipwreck Cove completed                            | —                           | 125 / 250 / 1 fragment           |
| 5   | `whispering-jungle` | Whispering Jungle | PLACEHOLDER | Skull Reef completed                                | —                           | 150 / 300 / 1 fragment           |
| 6   | `treasure-island`   | Treasure Island   | PLACEHOLDER | Whispering Jungle completed **and** 5 map fragments | —                           | 500 / 1000 / 1 fragment          |

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

## Economy

- Drip: every approved activity while the adventure is active gives 5 coins and 10 XP.
- Level thresholds (XP): 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000.
- Items: resources (`supply-crate`, `compass-feather`), collectibles (`map-fragment` max 6, `magic-compass`,
  `gold-doubloon` display-only), ships (`ship-starter` granted at start; explorer 150c, voyager 400c,
  captain 800c, legendary 1500c, each gated by a chapter), upgrades (`upgrade-patched-sail` 40c,
  `upgrade-parrot-perch` 90c, `upgrade-brass-cannon` 200c), cosmetics (`cosmetic-captain-hat` 60c).
  Purchases go through `purchaseItem` (idempotent, never overdraws).
- Achievements: Deckhand (1 approved activity), Able Seaman (10), Ship Shape (1 routine), Anchors Aweigh
  (Home Port complete), True North (compass puzzle).

## Art direction (reference)

Polished colourful 3D-cartoon illustration, tropical pirate environments, wooden/parchment UI, big
readable markers, friendly characters, clear distinction between playable locations and decoration. All
current assets are flat-colour placeholders flagged `placeholder: true` in the manifest.
