# Phase 6 scope: launch preparation

Status: proposed scope, nothing started. Written after Phase 5 (the whole pirate campaign) was merged.
Each slice gets its own ADR first, then tests, then a PR. Slices run in the order below.

## Order of work

**A. Real email provider (first).** The driver interface already exists (`src/lib/email`, see `docs/development/EMAIL.md`).

- Add a driver that calls the provider's HTTPS API directly, so there is no new dependency. It throws if the message is not accepted.
- New env vars `EMAIL_DRIVER=resend`, `EMAIL_API_KEY` and `EMAIL_FROM`, with the full checklist (`src/lib/env.ts`, `.env.example`, `docs/development/ENVIRONMENT.md`, the README table, a dummy value in CI).
- ADR: send inline, with the `email_outbox` row kept as an audit and retry record. The hourly cron is too slow for verification mail.
- Document SPF, DKIM and DMARC for the sending domain.
- Production runs with `REQUIRE_EMAIL_VERIFICATION=true`.
- Tests: the driver with a mocked `fetch` (accepted, rejected, timeout), outbox status, and the auth flows.
- Limit: a live mail cannot be sent from the build container unless the environment allows the provider's host and holds a key. The key would be added through the credential flow, and the owner does a manual smoke test with a sandbox key.

**B. Security.**

- A nonce-based CSP through `src/proxy.ts`, plus HSTS.
- Puzzle attempt limits: backoff rather than lockout, enforced under the child lock. Failed attempts become a counter that is pruned, instead of one row each.
- Rate limiting for child sign-in and the health endpoint: Vercel Firewall at the edge plus a DB-backed window in code, with no Redis.
- `pnpm audit` and Dependabot in CI.
- A test that every action resolves its actor (`requireParentContext` / `requireChildContext`).
- A written threat model.

**C. Privacy and COPPA.** The legal review itself is a human step. The engineering deliverables are:

- a data inventory, plus privacy policy and parental-consent copy drafted for counsel;
- a stored consent record (a schema change);
- family data export, delete-a-child and delete-a-family flows with tests, and the retention jobs;
- photos stay deferred (recommended: no-go for the pilot).

**D. Accessibility (WCAG 2.2 AA).** Automated axe runs in Playwright across both shells and every puzzle UI, using one dev dependency (`@axe-core/playwright`). Then a manual keyboard, screen-reader, contrast and reduced-motion pass, and fixes.

**E. Art integration.** Replace the placeholders with the delivered assets:

- use `next/image` for raster art;
- add an `audio` manifest type and a sound manager;
- show the correct ship tier in the crew camp.

**F. PWA and performance.**

- A web manifest, icons and a hand-written service worker. The worker caches only the static shell and never personalized pages, because of shared devices.
- A mobile performance budget, measured once real art has landed.

**G. Journeys and load.**

- Full parent and child end-to-end journeys.
- An approval-pipeline load test with p95 numbers against real Postgres.

**H. Pilot.**

- Vercel and Supabase setup: pooled connections, a migration deploy job, secrets, backups.
- 3 to 5 families, with a feedback and triage loop.

## Art list

There are 29 manifest entries today, and every one is a placeholder SVG. The game also references assets that have no manifest entry at all (they are marked "missing" below).

| Group                                                                            | Count | Spec                                                                                                                        | Priority |
| -------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- | -------- |
| World map + chapter scenes                                                       | 1 + 6 | 1600×900. 35 clickable places sit at set % positions, so positions can be retuned to the art                                | Pilot    |
| Ships (starter, explorer, voyager, captain, legendary)                           | 5     | 320×240. Only the starter exists; the other four are missing. Include anchor points for the head, sail, deck and flag slots | Pilot    |
| Items and collectibles                                                           | 14    | 96×96, transparent background. `magic-compass` is missing                                                                   | Pilot    |
| Upgrades and cosmetics (icon + worn overlay)                                     | 5 + 5 | Overlays must align to the ship's slot anchors                                                                              | Pilot    |
| Achievement badges                                                               | 11    | 96×96. None exist in the manifest                                                                                           | Pilot    |
| Map marker states                                                                | 4     | Locked, unlocked, current, completed                                                                                        | Pilot    |
| Characters                                                                       | 2     | 256×256: the captain and Pip. A Blackbeard is optional                                                                      | Pilot    |
| Brand and PWA                                                                    | ~8    | App icon 192 and 512, a maskable icon, apple-touch 180, favicon, a 1200×630 social image                                    | Pilot    |
| Puzzle symbols (compass, tentacles, lock, glyphs, runes, repair parts and tools) | ~60   | 64×64. Puzzles are text today                                                                                               | Later    |
| Route-board tiles (ship, anchor, flag, water, rock variants)                     | ~10   | Reef, jungle and island themes                                                                                              | Later    |
| Celebration art (chapter complete, campaign complete)                            | 2     |                                                                                                                             | Later    |
| Sound effects (solved, oops, claim, purchase, tap, fanfare)                      | ~10   | `.ogg` plus `.mp3`                                                                                                          | Later    |

Format and naming:

- SVG is preferred, with 2× WebP as the fallback.
- Each asset keeps its manifest id as its filename.
- Every asset needs provenance and licence notes, which matters for a children's app.

### Assets already created

The assets that were created before the build were not found in the repo: it holds no raster or audio files. To hand them over:

- commit them to a branch of the repo (for example under `design/incoming/`) and note the formats;
- confirm who made them and that the owner holds the rights;
- they will then be mapped to manifest ids, with a gap list returned.

## Decisions for you

1. **Email provider.** Recommended: Resend (a simple HTTPS API with domain verification). Postmark is the alternative. The owner creates the account; a sending domain and from-address are needed.
2. **Where are the families?** US only (COPPA), or EU and UK too (GDPR and the Age Appropriate Design Code)? This changes the privacy slice.
3. **Parent two-factor for the pilot.** Recommended: skip it. Email verification plus strong passwords are enough for a small pilot.
4. **Error tracking.** Recommended: Vercel logs only for the pilot. A vendor would need its own privacy review.
5. **Start with slice A?** Confirm the order above, or say which slice should go first.

## Questions to answer before work starts

Answer inline (edit this file or reply in the chat). The ones marked **first** block the first slice.

**Assets** (needed for the art list and slice E)

1. **First:** where are the assets that were created before the build? The repo has none. Commit them to a branch (for example under `design/incoming/`).
2. What formats are they (SVG, PNG, WebP, audio files)? At what sizes?
3. Who made them, and does the project own the rights? Is there a licence or credit line to record?
4. Which items from the art list do they already cover, and which are still missing?

**Email provider** (slice A)

5. **First:** is Resend the provider, or Postmark or another?
6. **First:** which sending domain and from-address will mail come from (for example `no-reply@<your domain>`)? Can the domain's DNS be edited for SPF, DKIM and DMARC?
7. Who creates the provider account and a sandbox API key for the smoke test?

**Privacy and legal** (slice C)

8. Where are the families: US only (COPPA), or EU and UK too (GDPR and the Age Appropriate Design Code)?
9. Is a lawyer or privacy advisor engaged for the COPPA review? Legal lead time is long, so this should start early.
10. Do photos on chore submissions stay out of the pilot (recommended)?

**Security and operations** (slices B and H)

11. Parent two-factor for the pilot: skip it (recommended) or include it?
12. Error tracking: Vercel logs only (recommended) or a vendor, which would need its own privacy review?
13. Do the Vercel and Supabase accounts and the production domain exist yet, and who owns them?
14. Roughly how many pilot families, and when should the pilot start?

**Order**

15. Start with slice A as listed, or put another slice first?
