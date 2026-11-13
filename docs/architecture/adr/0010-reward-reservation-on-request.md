# ADR 0010 — Reserve points and stock when a reward is requested

Status: accepted (Phase 3, supersedes the Phase 1 "debit on approval" behaviour of `resolveRedemption`)

## Context

Phase 1 debited points when a parent approved a redemption. A child could therefore have several open requests that together cost more
than their balance, and a limited reward could be requested by many children at once. Phase 3 adds a parent catalogue with optional stock
and a child shop, so those races became reachable.

## Decision

- **Reserve at request time.** `requestRedemption` runs in one transaction that takes `lockChildRow`, then a `SELECT … FOR UPDATE` on the
  `reward_definition` row (always in the order child → reward), checks active/stock/balance, creates the `reward_redemption` (price
  snapshot in `costPoints`), debits the points through `postLedgerEntry` (`sourceKey = redemption:<id>:POINTS`, type `REDEMPTION`),
  decrements `stock` (when not null) and notifies the parents.
- **Approve** only changes the status (the points are already reserved); **fulfil** marks an approved request as given.
- **Deny** refunds through `postLedgerEntry` with a separate key (`redemption-refund:<id>:POINTS`, type `REDEMPTION_REFUND`), restores
  one unit of stock, stores `refundEntryId` and notifies the child with the parent's note.
- `resolveRedemption` takes the child and reward locks and **re-reads the redemption inside the lock**. Repeating the same decision is a
  no-op returning the resolved row; a conflicting decision is rejected (`INVALID_STATE`). Two parents resolving at once cannot both act.
- Database backstops: `reward_definition.stock >= 0` (CHECK), `reward_wallet.balance >= 0` and ledger CHECKs (existing),
  `refundEntryId` requires `ledgerEntryId` (CHECK), unique `sourceKey` on the ledger.
- Editing a reward's price affects only future requests (the redemption keeps its snapshot). Archiving hides it from the shop; open
  requests are still resolvable.

## Consequences

- A child's visible balance drops immediately when they ask, which matches "set aside" in the child copy.
- Zero-priced rewards are rejected at validation (price ≥ 1), so there is always a ledger entry to refund.
- A child can cancel their own `REQUESTED` request (`cancelRedemption`): same child → reward lock order, row re-read inside the lock, refund under `redemption-refund:<id>:POINTS`, stock restored, parents notified; after approval only a parent decline remains.
- Locks are taken child → reward everywhere, so concurrent requests serialize without deadlocking; the race tests loop several rounds.
