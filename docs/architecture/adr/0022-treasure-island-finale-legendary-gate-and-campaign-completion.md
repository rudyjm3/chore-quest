# ADR 0022 — Treasure Island: the finale, the legendary ship gate, economy rebalance and campaign completion

Status: accepted (Phase 5, slice 4)

## Context

Treasure Island (chapter 6) is the last chapter. Scoping decisions: the finale pays 1,000 coins; it needs the legendary ship (tier 5, the best ship); the extra rewards
are a collectible, a wearable flag, an achievement and a parent notification; the dig site is tied to the map fragments rather than to earlier artifacts; and the economy is
rebalanced (option 1) so the ship is reachable.

## Decision

### 1. Economy: the legendary ship costs 1,000 and chapters 4 and 5 pay 400 coins more

Measured by integration tests with the same minimum path as before (explorer and voyager bought, nothing else): 330 coins after the reef and 700 after the jungle. The legendary
ship, sold once Whispering Jungle is completed, cost 1,500: about **800 coins out of reach**, and the finale's own 1,000 coins arrive only after it unlocks. So the price drops to
**1,000** and Skull Reef and Whispering Jungle pay **+400** in theme data:

| Reward                                                                            | Before |   After |
| --------------------------------------------------------------------------------- | -----: | ------: |
| Skull Reef chapter reward                                                         |    125 |     175 |
| Quest `defeat-the-kraken`                                                         |     60 |     100 |
| Achievement Reef Navigator (`reef-chart-puzzle`), Kraken Slayer (`kraken-escape`) |      – | 50 each |
| Whispering Jungle chapter reward                                                  |    150 |     200 |
| Quest `follow-the-clues`                                                          |     50 |      70 |
| Quest `open-the-temple`                                                           |     70 |     110 |
| Achievement Clue Reader (`ruins-puzzle`), Temple Explorer (`temple-maze`)         |      – | 50 each |

Result: **520** coins after the reef and **1,100** after the jungle reward is claimed, so the 1,000-coin ship is affordable with 100 to spare. An integration test asserts those exact
numbers and buys the ship. The captain ship (800) stays an optional shop purchase that nothing depends on; the legendary ship needs no other ship. Children who already claimed earlier
rewards keep what they were paid; the new achievements are awarded when their puzzles are next solved, so they only reach children who have not solved them yet.

### 2. Unlock and the dig site

- `treasure-island` unlocks on `CHAPTER_COMPLETED whispering-jungle`, `ITEM map-fragment ×5` and `ITEM ship-legendary ×1`. The fifth fragment arrives with the jungle reward claim and
  the ship is bought in the shop (a purchase re-evaluates unlocks, ADR 0019), so there is no cycle and the locked screen names both missing items.
- Children whose chapter 6 was already `UNLOCKED` (the placeholder opened on the jungle and five fragments) keep it without the ship and get their quest rows from the ensure step.
- The **dig site** (the first puzzle location) needs the child to **hold 5 map fragments**, held and never spent, using the existing `requiresItemKey`/`requiresItemQuantity` gate:
  the story link ("you need the map to find the dig site") with no new engine code. The reward's sixth fragment completes the set (the item's maximum is 6).

### 3. The finale: one quest, a dig and three chained stages

- Main quest `find-the-treasure`: `dig-deep` (6 approved activities of any category), then three `COMPLETE_PUZZLE` stages chained with `requiresObjectiveKey`:
  `crack-the-lock` (`sequence-match`, hint names the whole pattern as agreed after the Kraken review), `read-the-runes` (`clue-order`) and `escape-the-traps` (`route-plan`, 8 x 8).
  Same machinery as the Kraken and the temple: no new objective type, no cost, nothing debited.
- Locations: Quest Board, Dig Site (stage 1, gated by the fragments), Chest Cave (stage 2), Trap Tunnel (stage 3), Lookout (decorative).
- The chapter completes when `find-the-treasure` completes.

### 4. Finale rewards, all through the existing bundles

- Chapter reward: **1,000 coins, 2,000 XP, 1 map fragment** (the sixth), **`blackbeards-treasure`** (COLLECTIBLE, LEGENDARY, maximum 1) and **`cosmetic-blackbeards-flag`**
  (COSMETIC, not for sale, maximum 1, `config.slot: "flag"`).
- The crew camp gets a new wearable slot `flag`: theme data only (an anchor in `src/game/themes/pirate/camp.ts`); slots are an open vocabulary (ADR 0013).
- Achievement "Legend of Blackbeard Bay" for completing the chapter (no coins; 200 XP).
- Placeholder SVGs and manifest entries for the two items and the island scene.

### 5. Campaign completion

- A pure helper decides when an adventure is finished: every chapter of it is `COMPLETED` (placeholders can never be, so the adventure cannot finish while any chapter is unbuilt).
  `getAdventureState` returns `campaignComplete`, and the map page shows a celebration card while it is true. It is **not stored or shown only once**: there is no "seen" state, which would need a
  schema change for a purely cosmetic gain.
- **Parent notification.** `evaluateChapterCompletion`, in the same transaction that completes the last chapter, calls `notifyParents` once with the dedupe key
  `adventure-complete:{childId}:{adventureId}`, so a replay or race writes one row per parent. Title "{child display name} finished {adventure title}!", no other child data.
  This adds one value, `ADVENTURE_COMPLETED`, to the `NotificationKind` enum: one small migration (`ALTER TYPE ... ADD VALUE`), a `docs/database/DATABASE.md` note and an icon in the notification list.

## Consequences

- Chapter 6 needs one migration (an enum value) and no new puzzle type, objective type or gate key.
- The economy changes touch earlier chapters' theme data, with tests updated to the new measured numbers.
- Children who have the placeholder chapter 6 unlocked are grandfathered (ensure step, tested).
- Limitations: the celebration card is permanent while the campaign is complete rather than shown once; the placement and route UIs are tap/button based; art is placeholder; failed attempts stay
  unbounded rows (Phase 6); the legendary ship has no ship-scene art yet (only the starter ship has one).
