# Asset audit and integration assessment (incoming art packs)

Date: 2026-11-17. Scope: the four ZIP packages received for the pirate adventure. **Nothing in `public/`, the asset manifest or the code was changed.** All findings and proposed changes below need owner approval first.

## Deliverables

| Deliverable                                                                                                              | File                                                                   |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Updated asset inventory (manifest-centric: 29 manifest ids, 16 referenced in code without an entry, 11 proposed new ids) | [`current-manifest-inventory.csv`](current-manifest-inventory.csv)     |
| Source-to-manifest mapping (116 source files: filename, intended manifest id, proposed target path, status)              | [`source-to-manifest-mapping.csv`](source-to-manifest-mapping.csv)     |
| Usable prototype asset list (22 files)                                                                                   | [`usable-prototype-assets.md`](usable-prototype-assets.md)             |
| Missing production asset list and recommended production order                                                           | [`missing-production-assets.md`](missing-production-assets.md)         |
| Image dimension and transparency audit (109 images, per file)                                                            | [`dimension-transparency-audit.csv`](dimension-transparency-audit.csv) |
| Ship anchor assessment                                                                                                   | [`ship-anchor-assessment.md`](ship-anchor-assessment.md)               |
| Provenance and license records (rights review pending)                                                                   | [`PROVENANCE.md`](PROVENANCE.md)                                       |
| Approved visual direction and how the prototypes compare                                                                 | [`visual-direction.md`](visual-direction.md)                           |

The extracted packages are in `design/incoming/<package name>/`, with the original filenames and directory structure.

## Headline findings

1. **Everything received is prototype or reference material.** None of it is production-ready: the packs say so themselves, and the audit agrees.
2. **The preferred Parrot Island reference image was received after the first pass and is now the approved visual direction** (stored in `design/reference/`, compared in [`visual-direction.md`](visual-direction.md)). It is a reference board with UI baked in, not a source of assets. Earlier artwork stays prototype or reference material, and every file now has a `direction_check` in the mapping: 9 are **off-direction** (including the Parrot Island scene and token, the Pip portrait and the dark HUD map) and 19 are **partial** matches.
3. **Usable temporarily: 22 files** (13 as-is, 9 after a small mechanical cleanup): five ship icons (two need speck removal), a clean ocean SVG, one Home Port scene, six Home Port location crops, a reward-chest crop, two character portraits, and the six island bases (after speck cleanup). See the usable list.
4. **Still missing for production:** five of the six chapter scenes, every item icon, cosmetic, achievement badge, branding and PWA asset, all puzzle art and all audio. See the missing list. The manifest has **29** placeholder entries, and the code references **16 more ids with no manifest entry** (four ships, `item.magic-compass`, eleven achievement icons).
5. **The ships cannot support reliable head/sail/deck/flag anchors.** The flag and sail positions differ by 10 to 17% of the ship width between tiers. Use them as whole-ship icons only. See the anchor assessment.

## What was received

| Package                 | Version | Files | Contents                                                                                                                                                              |
| ----------------------- | ------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home Port Chapter 1     | v4      |    26 | 16 scene, location, character, island, ship and map images, 4 screenshots, 2 concept boards, 2 HTML demos, README, gameplay spec                                      |
| Parrot Island Chapter 2 | v5      |    24 | 14 images (scene crop, location crops, characters, islands, ship), 3 screenshots, 2 concept boards, 2 HTML demos, README, gameplay spec, `asset_manifest.json`        |
| Pirate Island Assets    | v3      |    39 | 30 island PNGs (6 islands x 5 states), 2 UI PNGs, starter ship, 2 previews, 1 concept sheet, 1 HTML demo, README, `manifest.json`                                     |
| Pirate Ship Assets      | v2      |    36 | 5 ship tiers (256 px and source sizes), 12 animation frames plus strip, WebP and GIF, 6 older island cut-outs, ocean SVG, preview, HTML demo, README, `manifest.json` |

Totals: 109 raster images, 1 SVG, 6 HTML pages (read as text only, never run), plus 4 READMEs, 2 specs and 3 manifests, all read.

## Classification of all 116 source files

| Status                    | Files | Meaning                                                                                                                        |
| ------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------ |
| REFERENCE_ONLY            |    57 | Concept boards, screenshots, demo pages, baked-UI crops, native-size ship sources, and island state variants with baked badges |
| USABLE_TEMP               |    13 | Usable as-is for layout and playtesting, pending approval                                                                      |
| USABLE_TEMP_AFTER_CLEANUP |     9 | Usable after speck removal or an edge crop                                                                                     |
| DUPLICATE                 |    13 | 6 byte-identical and 7 re-encoded copies of another file                                                                       |
| OPTIONAL                  |    15 | Not needed now: 12 shifted animation frames, a sprite strip, an animated WebP, a nameplate                                     |
| SUPERSEDED                |     6 | Older low-resolution islands replaced by the Island Assets v3 set                                                              |
| REGENERATE                |     3 | Cannot be fixed: a Parrot Island scene with baked UI, a compass-shrine crop with bubble remnants, and the fog overlay          |

## Duplicates and outdated artwork

- **Byte-identical copies (6):** `starter_ship.png` exists in four packs (all identical to Ship Assets v2 `starter_ship_256.png`); `home_port_island.png` and `parrot_island.png` (Home Port v4) equal the Island Assets v3 base islands; `map_preview.jpg` (Island Assets v3) equals Home Port v4 `adventure_map.jpg`.
- **Re-encoded copies (7), visually identical:** the Parrot Island v5 copies of `adventure_map`, `child_pirate`, `hidden_cove`, `lighthouse`, `pip_parrot`, `reward_chest` and `parrot_island.png`.
- **Superseded:** the six low-resolution islands in Ship Assets v2 (238 to 267 px wide, baked name plates, content clipped at the canvas edge). The Island Assets v3 base islands replace them.
- **Three versions of the same map:** `adventure_map.jpg` (1600x965) carries the baked HUD in two packs plus a preview; none is usable as a background.

## Quality issues

| Issue                                                                         | Where                                                                                                                                                                                 | Impact                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Baked UI** (logo, labels, markers, badges, progress panels, speech bubbles) | `adventure_map.jpg`, `home_port_alt.jpg`, `parrot_island_scene.jpg`, four Parrot Island location crops, island state variants (`current`, `completed`, `locked`)                      | Cannot be used as clean scenes or tokens; names and states must be drawn by the app        |
| **Low native resolution**                                                     | Ships: real art 113 to 121 px wide upscaled ~1.4x to 256. Islands: ~250 px of detail upscaled ~2x to 640x480. Location crops: 440x294 or 520x360                                      | Soft at 1x and blurry on 2x screens; fine for prototyping                                  |
| **Stray pixels**                                                              | Red ship 7 specks (308 px), blue ship 4 (77 px); island bases: Parrot Island 14 components (specks up to 254 px), Treasure Island 4 fragments (473 px), others 2 to 3                 | Mechanical cleanup (remove tiny alpha components)                                          |
| **Edge fringing**                                                             | Ships: dark or blue matte fringe at the hull and edges                                                                                                                                | Visible on light backgrounds                                                               |
| **Rough cut-out edges**                                                       | Island bases; pack README notes it                                                                                                                                                    | Needs a redraw for production                                                              |
| **Canvas inconsistencies**                                                    | Home Port island sits ~25 px higher than the other five (bottom margin 143 vs 110 to 122); `locked` variants clipped at the left edge (margin 0); older islands touch the canvas edge | Uneven ground line and clipped fog                                                         |
| **Fog overlay**                                                               | `locked_fog_overlay.png` 480x250, every pixel semi-transparent                                                                                                                        | A visible rectangle on any background                                                      |
| **Opaque JPG characters**                                                     | `captain`, `pip_parrot`, `child_pirate`                                                                                                                                               | Scene backgrounds baked in, edges cropped, a speech-bubble fragment on Pip; portraits only |
| **Frame remnants**                                                            | Home Port location crops (`crew_camp`, `quest_board`, `lighthouse` strongly)                                                                                                          | About 6 px of dark border to crop                                                          |
| **Aspect ratios**                                                             | `adventure_map` 1.658, `home_port_scene` 1.975, `home_port_alt` 1.866; ocean SVG 1.6 (16:10). The app uses 16:9                                                                       | Crop or recompose                                                                          |
| **Concept sheet alpha**                                                       | `island_design_reference.png` is RGBA but never fully opaque                                                                                                                          | Reference only                                                                             |

### Style consistency

All packs share one glossy, saturated cartoon style, so the prototypes look like one family at a glance. Differences that matter: the five ship tiers share the viewpoint but not hull details, flag placement or sail construction (the pack says so); the island tokens and the scene crops come from different concept sheets with different lighting and edge quality; the characters are crops of three different scenes. A production set needs one camera, one outline weight and one lighting direction per category, defined by the approved reference.

## Dimension check against the current manifest

| Manifest id (declared size)                  | Closest incoming asset           | Mismatch                                                            |
| -------------------------------------------- | -------------------------------- | ------------------------------------------------------------------- |
| `map.world` 1600x900                         | `ocean_background.svg` 1600x1000 | 16:10 vs 16:9, crops                                                |
| `scene.*` 1600x900                           | `home_port_scene.jpg` 1564x792   | About 2:1, a 16:9 crop loses ~150 px                                |
| `character.captain`, `character.pip` 256x256 | 366x452 and 220x410 opaque JPG   | Portrait ratio, opaque; new ids proposed, SVGs stay                 |
| `ship.starter` 320x240                       | 256x256 PNG                      | 1:1 vs 4:3, fits with `object-contain`; four ship ids have no entry |
| Items and icons 96x96                        | none                             | n/a                                                                 |

## Spec drift between the packs and the built game

The packs' HTML demos and gameplay specs are prototypes. The game in this repository is authoritative. Differences to remember when reading them: the compass order in the v5 spec is E, N, W, S (the game's sequence is N, E, S, W); the captain is called "Crewbeard" in places; chapter rewards, coin values and ship-tier unlock points differ (the pack buys nothing: ships unlock by chapter, while the game sells them in the shop); the demos' "parent review" button is explicitly not secure and is not a model for approvals. None of this affects the artwork except where the art assumes the demo's rules.

## Proposed changes (none applied; each needs approval)

| #   | Change                                                                                                                                                                               | Risk                                                                                                       | Needs                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1   | Turn the approved reference into a one-page style guide (palette, outline, lighting)                                                                                                 | Blocks the production art                                                                                  | Owner or artist                  |
| 2   | Add the five prototype ships as **new files** (`ships/ship-*.png`) and add the four missing manifest entries; keep the SVG placeholder for `ship.starter` until a switch is approved | Low. Icons only; no anchors                                                                                | Owner approval                   |
| 3   | Run a mechanical cleanup (remove specks, crop frame remnants) into a separate `prototype/` folder, never overwriting the incoming files                                              | Low                                                                                                        | Approval                         |
| 4   | Show the right ship in the crew camp (highest owned tier) and make anchors per ship                                                                                                  | Code change in `camp.ts` and the crew-camp page; do only with the rigged set                               | Phase 6 slice E                  |
| 5   | Use island bases as map markers (`marker.island.*`) under the existing state markers; add the ocean SVG as the temporary map base                                                    | Medium: `adventure-map.tsx` change; marker positions (`mapMarker`) stay as authored                        | Approval and a design check      |
| 6   | Use `home_port_scene.jpg` as a temporary `scene.home-port`                                                                                                                           | Medium: the seven authored hotspot positions do not match this art, and a retune changes gameplay hotspots | Explicit approval for any retune |
| 7   | Decide whether `design/incoming/` (45 MB of binaries) is committed, kept out of git, or stored with Git LFS                                                                          | Repository size                                                                                            | Owner                            |

Preserved: all asset ids, every authored hotspot position, and every working placeholder. Nothing has been renamed, overwritten or deleted.

## Open questions

1. Does the approved Parrot Island direction apply to all six chapters, or should each chapter get its own reference? Which single logo is the brand logo (the reference and the earlier boards differ)?
2. Pilot art decision: ship the current placeholders, the approved prototypes (after cleanup), or wait for production art?
3. Are the proposed changes 2, 3 and 5 approved as temporary prototype use, and is a hotspot retune (change 6) acceptable?
4. Please provide the provenance unknowns listed in `PROVENANCE.md` (prompts, dates, service tier, edits, trademark status).
5. Where should the 45 MB `design/incoming/` live: git, git-ignored, or Git LFS?
