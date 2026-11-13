# ADR 0012 — Supply shop rules are one pure module, enforced in the purchase transaction

Status: accepted (Phase 4 start)

## Context

`purchaseItem` only checked the coin price and the item's `maxQuantity`, while item `config` already carried unlock requirements
(`requiresShipTier`, `requiresItemKey`, `requiresChapterKey`). A child shop that greyed items out in the UI but let a hand-crafted request
buy them would trust client state. `purchaseItem` also accepted any `(familyId, childId)` pair.

## Decision

- `src/features/shop/shop-state.ts` is pure and theme-neutral: it parses the generic config keys with Zod and returns one of
  `available | max-owned | cant-afford | locked` with a child-friendly reason. The page and the service call the same function.
- `purchaseItem` (still `lockChildRow` first, idempotent on the client key) re-derives the context inside the lock (`loadShopContext`: coin balance,
  owned items, best owned ship tier, completed chapters) and refuses `max-owned` and `locked`. Affordability remains enforced by `postLedgerEntry`
  (overdraft check + wallet CHECK). The child must belong to the stated family, else `NOT_FOUND`.
- Only items with a `costCoins` in config are for sale; resources and the starter ship never appear.
- The page mints a fresh idempotency key per render (`export const dynamic = "force-dynamic"`), so a double click or retry charges once and a
  successful purchase revalidates to new keys.
- Item art is resolved from the theme manifest by `iconKey` (`getItemAsset`); missing art falls back to a neutral icon. Rarity is shown with a
  word, marks and border style, never colour alone.
- Child navigation uses a "More" menu (as the parent side does): Today, Goals, Adventure, Supplies, More (Treasure chest, Reward shop, Badges, History).

## Consequences

- Adding a requirement type means one change in `shop-state.ts` and its tests; UI and server stay in step.
- A retried request with the same key but a different item still returns the original purchase (the debit key is per idempotency key); keys are per render and per button, so this cannot happen from the UI.
- Held-item rules count `quantity > 0` rows only; consuming an item later can re-lock dependants, which is intended.
