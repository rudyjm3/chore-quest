# Testing

| Layer       | Command                 | Location            | Database                                                                                                       |
| ----------- | ----------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Unit        | `pnpm test`             | `tests/unit`        | none                                                                                                           |
| Integration | `pnpm test:integration` | `tests/integration` | `TEST_DATABASE_URL` (migrated + seeded by `tests/helpers/global-setup.ts`, household data wiped between tests) |
| End-to-end  | `pnpm test:e2e`         | `tests/e2e`         | `DATABASE_URL` with `pnpm db:seed:dev` fixtures; production build on port 3100                                 |

## What is covered

Unit: local dates and DST, recurrence, goal progress/streaks, reward math and source keys, engine unlock /
objective rules, pirate content validity, puzzle verifier, Zod schemas, authorization helpers.

Integration (spec edge cases): FK/uniqueness/CHECK constraints, transaction rollback, occurrence
generation idempotency, approve twice, four concurrent approvals, pipeline re-run, submit already-approved,
reject → resubmit → approve, auto-approve, a chore feeding multiple goals, two same-day chores on a streak,
streak partial index, weekly goal across a timezone boundary with weekly roll-over, chapter reward double
claim (parallel), full Home Port → Parrot Island progression incl. puzzle gating, idempotent purchase and
overdraft refusal, cross-family access, guardian vs owner permissions, child PIN lockout and sessions,
recurring task edited after completion, a recurring weekly goal completed in its first week rolling forward,
concurrent completion of a routine's last steps, auto-approved routines, rejected routines reopening
their steps.

E2E smoke: landing, health, sign-in pages, security headers, anonymous redirects, wrong password, parent
sign-in + navigation + children list, parent session cannot enter child area, child sign-in with family
code + PIN, today view, adventure map markers, child session cannot enter parent area, wrong PIN,
device hand-over signs the parent out.

Phase 2 additions — unit: completion-window logic (inclusive bounds, overnight, DST, timezone), history cursor, window schema, cron route
auth. Integration: maintenance job (7 local days per timezone, idempotent, goal expiry, completion retry, outbox pruning), task/assignment
editing never rewrites occurrences, archived children skipped, child profiles (avatar allow-list, archive/restore, PIN reset, code rotation),
routine editing (reorder permutations, optional steps, archive), window enforcement with a faked clock, history pagination (ties, filters,
scoping, tampered cursor, page-size clamp), invitations (hash-only storage, expiry, revoke, wrong email, concurrent accept, OWNER only, caps,
mail failure) and the `family_invitation` constraints. E2E: preset browser, task edit/archive, avatar + child archive/restore, routine reorder,
history page, settings; sign-up verification, password reset and the invite → accept → remove flow (desktop project only, because auth endpoints
are rate limited).

Phase 3 additions — unit: `recomputeProgress`/`effectiveTarget`, audit summary rendering (known actions, unknown fallback, no raw JSON,
tolerates wrong types, prefix validation). Integration: goal editing (target lowered completes once, raised keeps completed, archive/restore,
per-assignment target, extending an expired assignment, weekly dates locked, cross-family), expiry job vs weekly roll-over, progress repair
(corrupt the cached counters and prove the repair restores them for count and streak goals, idempotent, completes once), reward catalogue
(audit, `stock >= 0` CHECK, cross-family), redemptions (reserve at request, insufficient points/stock, **raced** requests against one balance
and for the last unit, deny refund once, **raced** double-resolve, fulfil ordering, refund-needs-debit CHECK), notifications (fan-out, privacy
between recipients, dedupe, cursor pagination, one-recipient CHECK), bulk approve (partial failures, duplicates, re-send safe, size limit,
cross-family), routine-run review notes, audit log (scoping, pagination, prefix not substring, date range, no metadata leak) and the
achievement gallery (hint only while locked). The race tests loop six rounds each; removing the child/reward locks makes the
single-balance race fail. E2E (`phase3.spec.ts`, desktop for mutating flows): goal edit/recalculate/archive/restore, reward add → child request
→ parent decline with note → refund, notifications on both sides, audit log without raw JSON, child achievements hint, mobile "More" menu.

Parrot Island slice — unit: location view selection (which locations have pages, grove slots, shrine waiting/solved, clamping), the scene store (silent by default, only the sound preference is stored, throwing/missing storage tolerated, signals replay), puzzle `toClientView` never contains the answer and verifier feedback is vague and theme-neutral, lighthouse state key parsing. Integration: location pages (own feather count only, shrine gate and solved state, `getPuzzleForChild` view without the answer, locked chapter refused, solved per child), lighthouse (one look per household-local day across the timezone boundary, per child, not started, equipped/unknown keys kept, corrupt value ignored, **5 racing looks looped 8×** and **a look racing an equip looped 15×**; both fail with `lockChildRow` removed from `lookOutFromLighthouse`, verified). E2E (`phase4-parrot.spec.ts`, desktop only; it builds its own household in the database and deletes it afterwards): feather grove slots, locked then open shrine, build/undo/clear, wrong attempt (vague text, picks kept, wobble animation), reduced motion turns the animation off, sound off by default and remembered, solve, adventure state free of animation/sound keys, 404 for non-page locations, anonymous redirects; `phase4-port.spec.ts` covers the lighthouse button.

## Conventions

- Fixtures in `tests/helpers/fixtures.ts` create families/children/tasks directly; use services for the
  behaviour under test.
- Integration tests run serially (`fileParallelism: false`) because they share one database.
- Keep e2e at smoke level until Phase 6; richer journeys are listed in the roadmap.
- E2E reads emailed links from the `email_outbox` table (`tests/e2e/outbox.ts`), the same data `/dev/outbox` shows.

Home Port polish (ADR 0018) — unit: `findQuestLocation` and location on board quests, `buildSceneSlots`, pirate scene data (every wearable slot anchored, art in the manifest). Integration: quest locations from seeded config. E2E (`phase4-port.spec.ts`): quest detail opens, shows steps/reward, ≥44px targets, Escape closes and focus returns to the button; the ship scene shows the hat after wearing and clears after taking it off.

Home Port slice — unit: adventure state schema, slot helpers, quest board selection and reward text, dialogue situation/line selection (deterministic, rotating, every situation authored), lighthouse hint. Integration: crew camp (owned vs not owned, wrong slot, non-wearable, unknown item, other child's item in the same family, other family's context, other state keys kept, **racing equips of different slots looped 15×** plus a deterministic lock-holding test), quest board scoping (sibling's progress never shown), lighthouse hint from seeded config, hidden cove (locked, once only, found stays found, per-child, unknown/locked-chapter places, **5 racing visits looped 8× with exactly one grant**). E2E (`phase4-port.spec.ts`, desktop only for the mutating flow): Home Port hub, Pip line, quest board with reward text, lighthouse, hidden cove state, buy a hat, wear and take it off (persisted across reload, ≥44px targets), anonymous visitors redirected from every new page. The crew-camp and cove race tests were verified by temporarily removing `lockChildRow` (both fail); note the cove's lock-holding test also blocks on the `child` foreign-key check, so the looped race is the discriminating test there.

Phase 3 follow-ups / Phase 4 start — unit: `formatLocalDateTime` across zones and DST, shop rules. Integration: routine step add/remove for every run state, last required step, retired-step uniqueness, tick-versus-edit races (looped, plus a deterministic lock-holding test), child cancelling a reward request (refund once, double cancel, raced against parent approve, cross-child/family), notification retention (age windows, batching, idempotent, family-neutral), supply shop (double submit, overdraft, max quantity, requirements, cross-family, raced purchases against one balance). E2E: add/remove a routine step, child buys a supply item and sees it in the treasure chest.

Shipwreck Cove slice (ADR 0019) — unit (`pair-match.test.ts`): the verifier (right, wrong, partial, empty, extra, unknown, duplicated, malformed answers; malformed configs; no partial-credit leak in feedback), `toClientView` never contains the answer (and the pirate puzzle's tool order does not follow its solution), the item-hold gate helpers. Integration (`shipwreck-cove.test.ts`, plus a quantity case in `hidden-cove.test.ts`): the chapter stays locked until the explorer is bought and a purchase unlocks it in the same transaction, the economy (210 coins at Parrot Island completion against a 150-coin ship), salvage accrual by category, a closed Wreck leaves no attempt row, wrong and partial answers, planks held and not consumed, the gate reads what is held now, the full chapter flow through the reward claim and Skull Reef unlocking, siblings and other households never see each other's salvage or attempts, a puzzle race (8 parallel correct submissions: one attempt, rewards once) and the ensure step (starting from the placeholder data, then loading the new theme data with the real seed; grandfathered unlock kept; idempotent; the completion pipeline heals by itself; a claimed quest is not reopened). Mutation checks done by hand: removing `lockChildRow` from `submitPuzzleAnswer` fails the race test, removing the item gate fails three tests, stubbing the ensure step fails three. E2E (`phase5-cove.spec.ts`, desktop for the mutating flow): locked map text, gated Wreck, salvage yard slots, answer absent from the page HTML, wrong then fixed matching, held planks, chapter reward and Skull Reef unlocking.

Skull Reef slice (ADR 0020) — unit: `route-plan.test.ts` (valid routes by rule, several accepted; wandering and returning to the goal; partial, overshooting, reef, off-board, diagonal/unknown-direction, malformed and over-long answers; config rejects out-of-bounds, equal start/goal, reefs on either, duplicates, unsolvable boards; `toClientView` is exactly the board, reefs sorted row by row, no route or answer keys; `stepOnBoard`) and `skull-reef-data.test.ts` (chapter data: gates, chained Kraken stages with the right puzzle types, no grants or costs, blocked straight route on every board, manifest entries, Whispering Jungle still empty; `puzzleWaitingFor`). Integration (`skull-reef.test.ts`, plus the cove tests updated for the new numbers): the economy (315 coins at cove completion, 415 after the claim, voyager 400), voyager gate (locked until bought, both requirements named before the cove is done, early purchase refused, purchase unlocks in the same transaction, replay is a no-op), chart pieces held and not spent, the closed chart table writes no attempt row, any safe route accepted and bad routes refused, the Kraken quest locked behind the chart (a stage cannot be solved while its quest has not started: **regression for the gate added in ADR 0020**), stages refused out of order with no attempt rows, rewards in order and the tooth, nothing ever debited, the full chapter flow through the reward claim (3 parallel claims pay once) and Whispering Jungle opening as an empty placeholder, optional side quest, siblings and other households, puzzle races (8 parallel correct submissions of the route puzzle and 6 of the first Kraken stage pay once) and the ensure step (placeholder data first, then `seedReferenceData`; grandfathered unlock kept without the voyager; the first quest and side quest get rows, the Kraken quest waits; idempotent; the completion pipeline heals by itself). Mutation checks done by hand and restored: removing `lockChildRow` from `submitPuzzleAnswer` fails three race tests (two new ones and the cove's), removing the locked-quest rule fails two tests, stubbing the ensure step fails both ensure tests. E2E (`phase5-reef.spec.ts`, desktop for the mutating flow): locked map text, shop purchase unlocking the chapter, waiting messages for Kraken stages, the gated chart table, answer-free page HTML, arrow-button board (impossible steps refused, undo/clear, the button off until the goal), all three Kraken stages in the browser, chapter reward and Whispering Jungle opening; `phase5-cove.spec.ts` now expects Skull Reef to stay locked behind the voyager.
