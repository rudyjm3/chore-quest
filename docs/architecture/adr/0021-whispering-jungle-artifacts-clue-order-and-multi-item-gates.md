# ADR 0021 — Whispering Jungle: artifacts as held items, the `clue-order` puzzle and multi-item gates

Status: accepted (Phase 5, slice 3)

## Context

Whispering Jungle (chapter 5) is about reading clues and finding named artifacts. Three questions were settled in scoping:

1. Does the jungle need a ship, like chapters 3 and 4? (The catalogue already has `ship-captain`, 800 coins, sold once Skull Reef is completed.)
2. Are artifacts a new objective kind or plain items? (Decided: plain held items, no new objective type.)
3. The location gate takes one item key and a quantity (ADR 0014, 0019), which cannot say "needs the idol **and** the mask **and** the key".

## Decision

### 1. No ship gate: the jungle unlocks on `CHAPTER_COMPLETED skull-reef` alone

Measured by an integration test: a child who buys only the explorer (150) and the voyager (400) and does the minimum holds **330 coins** when
Skull Reef is complete and its reward claimed (15 left after the voyager, plus 25 for the five chart chores, 20 + 40 for the chart puzzle and quest, 10 + 15 + 20 for the
Kraken stages, 60 for the Kraken quest and 125 for the chapter reward). An 800-coin captain would be about **470 coins out of reach**, and raising reef rewards by that
much would distort every earlier chapter. So the unlock config is unchanged (it already was the reef alone), `ship-captain` stays a shop purchase gated by Skull Reef
(`requiresChapterKey`), and nothing about the economy changes in this slice. The test also asserts the unlock requirements contain no item, so a later edit cannot
reintroduce a gate the economy cannot pay for without failing a test.

### 2. Artifacts are held items

- `jade-idol`, `stone-mask` and `sun-key` are COLLECTIBLE items with `maxQuantity: 1`. Each is granted by its own chore-driven objective
  (`APPROVED_ACTIVITIES`, any category, `grantItemKey`), chained with `requiresObjectiveKey` so they are found one after the other. The engine grants per unit of progress and
  clamps at `maxQuantity`, so an artifact appears on the first chore of its search objective and the second chore only completes the objective. That is a known oddity, kept
  because the alternative is an engine change (grant on objective completion) for no new capability.
- No new objective type, no debit path, nothing is spent: artifacts are only held.

### 3. `requiresItems`: a gate on several items

- `chapterLocationSchema` gets `requiresItems: [{ itemKey, quantity }]` (default empty) beside `requiresItemKey`/`requiresItemQuantity`. The legacy pair keeps
  working and is simply one more entry. A location is open while the child **currently holds every listed item** at its quantity; nothing is consumed.
- The pure helpers in `src/game/engine/location-gate.ts` become plural: `locationItemGates(location)` (the legacy pair plus `requiresItems`, one entry per item with the largest quantity),
  `puzzleItemGates(locations, puzzleKey)` (the same merge across every location that opens the puzzle: the strictest wins per item) and `unmetItemGates`. The server enforces
  them in `submitPuzzleAnswer` and `visitLocation` under the child lock, exactly as before; no attempt row is written while a gate is unmet.
- `getPuzzleForChild` returns `gates` (each with `met`) and keeps `gate` (the first unmet gate, else the first, else null) so existing readers and tests keep working. The puzzle panel
  lists everything still missing.

### 4. The `clue-order` puzzle type

- New verifier `src/game/puzzles/clue-order.ts`. The child puts 3 to 6 named things into numbered places (slot 1 is leftmost) using clues.
  Config: `items` (`{ key, label }`), `clues` (each `{ rule, text }`) and an optional `hint`. Rules (a small closed set, all checked by rule, no stored answer):
  `left-of { a, b }`, `next-to { a, b }`, `not-next-to { a, b }`, `in-slot { a, slot }`, `not-in-slot { a, slot }`.
- Answer: `{ order: string[] }`, the item keys from slot 1 to the last slot. It is correct when it is a permutation of the items that satisfies **every** clue.
- `parseConfig` enumerates every ordering (at most 720) and **rejects a config whose clues have no solution or more than one**, so the only accepted answer is the unique solution and
  "satisfies every clue" and "is the answer" are the same thing. It also rejects unknown keys, a slot out of range, and a clue that names the same item twice.
- Client view: `items` (sorted by key), `clues` (the texts only, in authored order) and `hint`. The clues are the puzzle, so they are visible; the **answer ordering is never stored or
  sent**. The text of a clue is theme data and must say what its rule says; the unit test of the theme data re-derives the unique solution from the rules, so a text that disagrees with
  its rule is caught only through the rule (the rule is what is enforced and the text is reviewed by hand, noted as a limitation).
- Feedback is the same vague line as the other puzzles. Failed attempts are stored one row each as before; the answer space is at most 720 and a full deduction is possible from the clues,
  so blind guessing is possible but never required. Attempt limits stay deferred to Phase 6.

### 5. Content and flow

- `follow-the-clues` (main): three chained artifact searches, then the ruins puzzle (`clue-order`), whose location needs all three artifacts (`requiresItems`).
  `open-the-temple` (main, `requiresQuestKey: follow-the-clues`): two chained puzzle stages, `pair-match` glyphs then a `route-plan` vine maze. Same pattern as the Kraken; no cost.
- Side quest `jungle-explorers`: two completed routines, optional.
- Chapter reward unchanged (150 coins, 300 XP, 1 map fragment); completing both main quests completes the chapter. Treasure Island then needs five map fragments, which the child holds once
  the jungle reward is claimed (Home Port, Parrot Island, the cove, the reef and the jungle), and opens as the same empty placeholder: no content there.
- Placeholder art: SVGs and manifest entries for the three artifacts and the jungle scene.

## Consequences

- Chapter 5 needs one new puzzle type and one additive config key; no schema change, no migration, no new objective kind.
- `requiresItems` is a new config key (documented in `docs/gameplay/GAME_ENGINE.md`); older config behaves as before.
- Children whose Whispering Jungle was already unlocked (the placeholder opened on the reef alone) are grandfathered; the ensure step gives them the first quest and the side quest, and the
  temple quest follows when the first is claimed.
- The captain ship stays unlinked from progression. If a later slice wants it as a gate, the economy must be rebalanced first (see the numbers above).
- Limitations: the artifact appears on the first chore of its search; clue texts are reviewed by hand against their rules; the placement UI is tap-based; no attempt limits; placeholder art.
