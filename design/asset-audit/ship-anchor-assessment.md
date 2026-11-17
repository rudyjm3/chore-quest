# Ship anchor assessment

Question: can the requested **head, sail, deck and flag** attachment anchors be established reliably for the five prototype ships (`Chore_Quests_Pirate_Ship_Assets_v2/assets/ships/*_256.png`)?

**Verdict: no, not for real attachment points. Do not set per-ship anchors from this art.** Only coarse bounding-box references are consistent. No anchors were invented and nothing in `src/game/themes/pirate/camp.ts` was changed.

## How it was measured

Each 256x256 ship PNG (alpha above 40 counted as artwork) was measured with a script kept outside the repo. All positions are normalised to that ship's own artwork box (0 to 1, left to right and top to bottom) so ships of different widths compare fairly.

| Ship (pack colour, game tier) | Artwork box | Top tip x | Upper-third centroid (x, y) | Black flag centroid (x, y) | Hull centroid (x, y) | Widest row y | Stray specks |
| ----------------------------- | ----------- | --------- | --------------------------- | -------------------------- | -------------------- | ------------ | ------------ |
| starter (Starter)             | 161x184     | 0.466     | 0.531, 0.212                | 0.547, 0.217               | 0.414, 0.834         | 0.571        | 0            |
| red (Explorer)                | 168x184     | 0.417     | 0.535, 0.246                | 0.510, 0.250               | 0.447, 0.834         | 0.647        | 7 (308 px)   |
| blue (Voyager)                | 165x184     | 0.352     | 0.472, 0.223                | 0.514, 0.218               | 0.405, 0.830         | 0.380        | 4 (77 px)    |
| black (Captain)               | 156x184     | 0.295     | 0.432, 0.215                | 0.407, 0.205               | 0.389, 0.829         | 0.418        | 0            |
| gold (Legendary)              | 149x183     | 0.369     | 0.435, 0.214                | 0.410, 0.213               | 0.387, 0.833         | 0.650        | 0            |

Spread across the five ships:

| Measure                                   | Horizontal spread (share of ship width) | Vertical spread       |
| ----------------------------------------- | --------------------------------------- | --------------------- |
| Top tip (mast or flag)                    | **0.171**                               | 0 (all at y 35 to 36) |
| Upper-third (sail and flag area) centroid | **0.103**                               | 0.034                 |
| Black flag centroid                       | **0.140**                               | 0.045                 |
| Hull centroid                             | 0.060                                   | 0.005                 |

## What can be said

| Anchor wanted                 | Reliable?     | Why                                                                                                                                                                                    |
| ----------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Waterline / hull bottom**   | Yes, coarsely | All ships were normalised to the same height (183-184 px) and sit on the same baseline (artwork box bottom at y 218; hull centroid at 0.83 of the height).                             |
| **Overall horizontal centre** | Yes, coarsely | Artwork is centred on the canvas, but the artwork box width varies by up to 19 px (149 to 168).                                                                                        |
| **Flag**                      | No            | The flag sits 14% of the ship width apart between ships, and the top tip moves by 17%. The flag is also not the same flag: the pack's own caveats say flag placement is not identical. |
| **Sail**                      | No            | Sail shape, colour and position change per tier (striped, red, blue, black with skull, gold), with a 10% horizontal spread. A worn "patched sail" overlay would not line up.           |
| **Deck**                      | No            | There is no consistent deck line. The widest-row position (a rough proxy for the rail) jumps between 0.38 and 0.65.                                                                    |
| **Head**                      | No            | There is no defined mast top or crow's nest; the top tip is a flag or mast corner that differs per ship.                                                                               |

The pack's own manifest agrees: "hull details and flag placement are not identical" and the ships are "not a genuine 360-degree turnaround". The source cut-outs are only 113 to 121 px wide, upscaled about 1.4x to the 256 canvas.

## What the app does today (unchanged)

`src/game/themes/pirate/camp.ts` defines one set of percent anchors for the whole ship scene (head 50/14, sail 50/40, deck 50/76, and flag 78/12) against `ship.starter`. They were placed for the SVG placeholder. The crew-camp page always draws `ship.starter`, whichever ship tier the child owns. Using the five prototype ships would therefore need two code changes that have **not** been made: choose the ship by the child's highest tier, and store anchors per ship.

## Recommendation

1. Use the prototype ships **only as whole-ship icons** (shop, treasure chest, inventory). They are good enough for that after speck removal on the red and blue ships.
2. **Do not** wire cosmetics, worn overlays or flag attachments to these sprites. Wait for the regenerated, rigged set.
3. Ask the artist for a rigged set: one shared camera angle and scale; identical mast position and height on all five tiers; a flag mount point and flag size that never move; a sail polygon drawn on its own layer per tier; a visible deck line; and the five hull silhouettes differing only in the details that mark the tier. Ship the five anchor positions as data (in `camp.ts`, per ship) measured from the final art.
4. Until then, keep the existing anchors for the placeholder. A coarse alternative that would be safe if wanted: anchor everything to the artwork box (waterline and centre), accepting about +/-10% error, but only for non-critical decoration.
