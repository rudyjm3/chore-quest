# Missing production assets, prioritized, and recommended production order

Basis: the current manifest (29 entries, all `placeholder: true` SVGs), the assets the code references that have **no manifest entry** (16), the new roles the received prototypes suggest, and the four incoming packages (all classified prototype or reference). Nothing has been created or changed; this is a plan.

Visual direction: the owner's **preferred Parrot Island reference is the approved direction** (`../reference/parrot-island-approved-reference.png`, analysed in `visual-direction.md`). It covers Parrot Island only; whether it applies to all six chapters is an open question. The earlier concept boards remain reference material.

Sizes: the manifest `width`/`height` is the 1x display size. Production files should be exported at 2x (for example scenes 3200x1800, items 192x192, ships 640x480) as WebP or PNG with transparency, or SVG where the art is vector. Keep each manifest id; only the path and the declared size change.

## Priority key

- **P0**: needed for a pilot that looks like one game, or blocks other art.
- **P1**: needed soon after, or depends on a P0 item.
- **P2**: polish; the app works without it.

## Gap summary

| Category                                       |          Needed | Prototype covers it                                                                      | Gap                                                                    | Priority                              |
| ---------------------------------------------- | --------------: | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------- |
| Style guide                                    |               1 | The approved Parrot Island reference (a board, not a guide)                              | Palette values, outline weights, lighting, camera, written down        | P0 (blocks all)                       |
| Branding and PWA icons                         |              ~8 | None (logo exists only inside concept boards and the baked map HUD)                      | All                                                                    | P0                                    |
| World map base + island markers                |           1 + 6 | Ocean SVG; 6 island bases (all need speck cleanup)                                       | Clean production base and 6 hi-res islands with consistent ground line | P0                                    |
| Chapter scenes (1600x900)                      |               6 | Home Port: 1 usable-as-is crop; Parrot Island: baked-UI crop (regenerate); other 4: none | 5 new + 1 production redo; hotspot-safe composition                    | P0                                    |
| Ships                                          |               5 | 5 whole-ship icons (2 need cleanup), not rigged                                          | Rigged, consistent 5-tier set with per-ship anchors                    | P0                                    |
| Characters (captain, Pip, child avatar)        | 3 (+1 optional) | 3 opaque portrait crops                                                                  | Transparent sprites, expressions, turnaround                           | P0 for captain and Pip, P1 for avatar |
| Collectibles and resources                     |              14 | None                                                                                     | All 14 (13 in manifest + `item.magic-compass`)                         | P0                                    |
| Cosmetics and upgrades (icons)                 |               5 | None                                                                                     | All 5                                                                  | P0                                    |
| Achievement badges                             |              11 | None                                                                                     | All 11 (no manifest entries)                                           | P1                                    |
| Worn cosmetic overlays                         |               5 | None                                                                                     | Depends on the ship rig                                                | P1                                    |
| Location art                                   |     35 hotspots | 6 Home Port crops (clean, 440x294)                                                       | 29 more plus higher resolution                                         | P1 to P2                              |
| Map and UI badges (locked, current, completed) |        4 states | Baked into prototype islands (not reusable)                                              | Drawn badges or keep code-drawn markers                                | P1                                    |
| Celebration art (chapter, campaign complete)   |               2 | One chest crop                                                                           | Clean art                                                              | P1                                    |
| Puzzle symbols                                 |             ~60 | None                                                                                     | All (puzzles work with text today)                                     | P2                                    |
| Route-board tiles                              |             ~10 | None (the board uses emoji)                                                              | All                                                                    | P2                                    |
| Sound effects                                  |             ~10 | None (a synthesised chime)                                                               | All, `.ogg` plus `.mp3`                                                | P2                                    |

## Detail by category

### Branding and PWA (P0)

| Item               | Spec                                                                                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logo and wordmark  | Vector master, light and dark backgrounds. The approved reference shows a gold "CHORE QUESTS" wordmark on a pirate-hat badge; the earlier boards show a different logo, so one must be chosen |
| App icon           | 512x512 and 192x192 PNG, plus a maskable 512x512 with safe zone                                                                                                                               |
| Apple touch icon   | 180x180                                                                                                                                                                                       |
| Favicon            | SVG plus 32x32                                                                                                                                                                                |
| Social/share image | 1200x630                                                                                                                                                                                      |

### World map and islands (P0)

| Item              | Manifest id                                      | Spec                                                                   | Note                                                                                                                                                                        |
| ----------------- | ------------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| World map base    | `map.world`                                      | 3200x1800, no labels, no markers, no HUD                               | The prototype `adventure_map.jpg` has all of these baked in, so it cannot be used. The ocean SVG is a temporary base.                                                       |
| Island markers x6 | proposed `marker.island.<chapter>` (new entries) | Transparent, same canvas and same ground line, about 2x current detail | Prototype bases are ~250 px of real detail upscaled to 640x480 and the Home Port island sits ~25 px off the others. States (current, completed, locked) stay code overlays. |

### Chapter scenes (P0)

One per chapter, 3200x1800 export, **no baked text, markers, characters or speech bubbles.** Keep the authored hotspot positions workable or agree a retune. Hotspots per chapter: Home Port 7, Parrot Island 4, Shipwreck Cove 4, Skull Reef 8, Whispering Jungle 7, Treasure Island 5.

| Scene id                                                                                       | Prototype                                     | Action                                                  |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| `scene.home-port`                                                                              | `home_port_scene.jpg` (usable as-is, caveats) | Replace in production; retune hotspots or paint to them |
| `scene.parrot-island`                                                                          | `parrot_island_scene.jpg` (baked UI)          | Regenerate from the approved reference                  |
| `scene.shipwreck-cove`, `scene.skull-reef`, `scene.whispering-jungle`, `scene.treasure-island` | None                                          | Create                                                  |

### Ships (P0)

| Item                                                                                       | Spec                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5 tiers: `ship.starter`, `ship.explorer`, `ship.voyager`, `ship.captain`, `ship.legendary` | One camera and scale; identical mast position and height; fixed flag mount; sail and flag on separate layers; visible deck line; export at 640x480 or larger. Four of the five ids have no manifest entry yet. |
| Anchor data                                                                                | Head, sail, deck and flag points per ship, measured from the final art (see `ship-anchor-assessment.md`)                                                                                                       |

### Characters (P0 and P1)

Transparent sprites at 512x512 or larger: captain (with Pip dialogue use), Pip (perched and flying), child avatar (front, side, back) later, and an optional Blackbeard for the finale. Three expressions each for the captain and Pip is enough for the pilot.

### Collectibles, cosmetics, achievements (P0 and P1)

All icons 192x192 at 2x, transparent, one lighting direction, readable at 48 px.

| Group                                        | Ids                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collectibles (14)                            | `item.supply-crate`, `item.compass-feather`, `item.salvage-plank`, `item.rope-coil`, `item.chart-piece`, `item.kraken-tooth`, `item.jade-idol`, `item.stone-mask`, `item.sun-key`, `item.blackbeards-treasure`, `item.map-fragment` (ideally six distinct pieces), `item.cove-pearl`, `item.gold-doubloon`, `item.magic-compass` (no manifest entry) |
| Cosmetics and upgrades (5)                   | `cosmetic.captain-hat`, `cosmetic.blackbeards-flag`, `upgrade.patched-sail`, `upgrade.parrot-perch`, `upgrade.brass-cannon`                                                                                                                                                                                                                          |
| Achievement badges (11, no manifest entries) | `achievement.deckhand`, `able-seaman`, `ship-shape`, `anchors-aweigh`, `true-north`, `master-shipwright`, `reef-navigator`, `kraken-slayer`, `clue-reader`, `temple-explorer`, `legend`                                                                                                                                                              |

### Puzzles and audio (P2)

Symbols (compass N/E/S/W, the four Kraken tentacle moves, the lock's anchor, skull, cannon and compass, five repair parts and tools twice, five glyphs and meanings, five runes) at 64x64; route tiles (ship, start, goal, water, trail, rocks per theme); audio: solved, oops, claim, purchase, tap, fanfare, plus optional ambience, `.ogg` and `.mp3`, with licence notes.

## Spec requirements for every delivered asset

- Transparent PNG/WebP or SVG with clean alpha (no halo, no specks, no semi-transparent matte), or opaque JPG only for full scenes.
- No baked text, badges, markers or UI; names, states and counts are drawn by the app.
- Consistent ground line and canvas per category; keep important detail away from the outer 5% so crops are safe on phones.
- Filename equal to the manifest id (`ship.voyager` becomes `ship-voyager.png`).
- Provenance noted per asset (see `PROVENANCE.md`): source, date, author, licence, reviewer.

## Recommended production order

Each step lists what it unblocks. Steps 2 to 4 can run in parallel once step 1 is done.

1. **Write the style guide (P0, blocks all).** The approved Parrot Island reference is in; turn it into a one-page guide (palette, outline weight, lighting, camera), settle one logo and whether the direction covers all six chapters, and fill in the provenance table. Decide whether the pilot ships prototype art, production art, or the current placeholders.
2. **Branding and PWA icons (P0).** Small, fast, and required by Phase 6 slice F.
3. **Ship rig, five tiers (P0).** Unblocks the shop, treasure chest and crew camp, the per-tier ship in the crew camp, and cosmetic overlays.
4. **World map base and six island markers (P0).** The first screen a child sees. The prototype ocean and the six island bases can bridge the gap after cleanup if the owner approves.
5. **Chapter scenes, in chapter order (P0).** Home Port, Parrot Island, Shipwreck Cove, Skull Reef, Whispering Jungle, Treasure Island. Agree hotspot-safe composition per scene first.
6. **Captain and Pip sprites (P0).** Needed beside the new scenes.
7. **Collectibles, cosmetics and upgrades (P0).** 14 + 5 icons.
8. **Achievement badges (P1).** 11 icons.
9. **Worn cosmetic overlays (P1).** After step 3.
10. **Celebration art, remaining location art, child avatar (P1 and P2).**
11. **Puzzle symbols, route tiles, audio (P2).**

Phase 6 slice E (art integration) starts when steps 1 to 4 are delivered; the rest can land in later releases because every asset goes through the manifest.
