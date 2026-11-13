# Architecture

Chore Quests is a **modular monolith** on Next.js. Two systems share one codebase and one database
but are kept logically separate:

- **System A — Family management**: families, children, tasks, routines, approvals, goals, rewards.
  Works entirely without any game.
- **System B — Adventure engine**: themes, chapters, quests, puzzles, inventory, chapter progression.
  Consumes _verified completion events_ produced by System A and never writes to System A's tables.

```mermaid
flowchart LR
  subgraph Clients
    P[Parent UI<br/>/parent/*]
    C[Child UI<br/>/child/*]
  end
  subgraph Next.js app
    A[Server Actions / Route Handlers]
    POL[Policies<br/>src/server/policies]
    subgraph Services (src/server/services)
      FAM[family / child]
      TASK[task / routine]
      APPR[approval]
      PROG[progression pipeline]
      GOAL[goal]
      REW[reward ledger]
      ADV[adventure / inventory]
    end
    ENG[Game engine (pure)<br/>src/game/engine + schemas]
  end
  DB[(PostgreSQL via Prisma 7)]
  P --> A
  C --> A
  A --> POL --> Services
  APPR -->|ActivityCompletion| PROG
  PROG --> REW
  PROG --> GOAL
  PROG --> ADV
  ADV --> ENG
  Services --> DB
```

## Module responsibilities

| Module (directory)        | Responsibility                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app`                 | Routing only. Route groups `(auth)`, `(parent)`, `(child)`, `(child-public)`, `(onboarding)`, `api`. Pages load data through services and render components.                           |
| `src/features/<domain>`   | Domain glue: server actions (`actions.ts`), pure domain logic (e.g. `tasks/recurrence.ts`, `goals/progress.ts`), and feature-specific components.                                      |
| `src/server/services`     | The only place that writes to the database. Plain async functions, `db` first argument, transactions where invariants span tables.                                                     |
| `src/server/policies`     | Who is acting (`ParentContext` / `ChildContext`) and what they may do. Pure helpers are unit-tested.                                                                                   |
| `src/game/schemas`        | Zod schemas for chapter/quest/objective/puzzle/adventure configuration and asset manifests. JSON in the DB is always parsed through these.                                             |
| `src/game/engine`         | Pure functions: objective eligibility, counters, unlock conditions, chapter completion, levels. No I/O.                                                                                |
| `src/game/themes/<theme>` | Authored content: the Pirate adventure definition, items, achievements, asset manifest. Seeded into the DB.                                                                            |
| `src/game/puzzles`        | Server-side puzzle verifiers keyed by `type` (currently `sequence-match`).                                                                                                             |
| `src/game/chapters`       | Loads chapter rows and validates their config.                                                                                                                                         |
| `src/lib/email`           | `EmailSender` interface, the development driver (stores mail in `email_outbox`), pure message templates. Real providers plug in here (ADR 0008).                                       |
| `src/lib`                 | Cross-cutting: `auth` (Better Auth + child sessions), `db` (Prisma client), `env`, `errors`, `validation` (Zod input schemas), `utils` (dates, source keys), `logging`.                |
| `src/components`          | `ui` (shadcn, generated), `layout` (parent/child shells + navs), `shared` (status badge, progress bar, quest/goal cards, map marker, dialog panel, empty/loading states, action form). |
| `prisma`                  | Schema, migrations, idempotent seed, dev-only demo seed.                                                                                                                               |
| `tests`                   | `unit` (pure), `integration` (real PostgreSQL), `e2e` (Playwright), `helpers`.                                                                                                         |

Dependency direction: `app → features → server/services → lib`, and `services → game/engine`.
`features` never import from `app`; `game/engine` never imports Prisma; `lib` never imports `server`.

## Directory conventions

- One domain per folder under `features/` and one `*.service.ts` per domain under `server/services/`.
- Server actions live in `features/<domain>/actions.ts`, start with `"use server"`, parse input with
  Zod via `parseOrThrow`, resolve the actor with `requireParentContext()` / `requireChildContext()`,
  call a service, `revalidatePath`, and return an `ActionResult`.
- Client components are the leaves (forms, interactive widgets). Pages and layouts are server components.
- Shared UI goes in `components/shared`; domain-specific UI stays in `features/<domain>/components`.
- Reference data (presets, adventure definitions) is authored in TypeScript and seeded by key.

## Database approach

- Prisma 7 with the `prisma-client` generator (output `src/generated/prisma`, git-ignored) and the
  `@prisma/adapter-pg` driver adapter. The datasource URL lives in `prisma.config.ts`.
- UUIDv7 primary keys; UTC timestamps; household-local dates as `@db.Date`.
- Every household-scoped row carries `familyId` so isolation checks are uniform and cascades are simple.
- Invariants the schema language cannot express (exactly-one-source, non-negative balances, one streak
  contribution per day, one puzzle completion) are CHECK constraints and partial unique indexes in
  migration `0007_integrity_constraints`.
- Idempotency is a database property: ledger entries and inventory grants have a unique `sourceKey`;
  goal/quest contributions are unique per (assignment, completion); occurrences are unique per
  (assignment, localDate); completions are unique per source record.

Full table reference: [docs/database/DATABASE.md](docs/database/DATABASE.md).
Date rules: [docs/database/TIMEZONES.md](docs/database/TIMEZONES.md).

## Authentication and authorization

- **Parents/guardians**: Better Auth (email + password) with the Prisma adapter. Tables `user`,
  `session`, `account`, `verification` are owned by Better Auth. The route handler is
  `app/api/auth/[...all]/route.ts`; the `nextCookies()` plugin lets server actions set cookies.
- **Children**: never Better Auth users. A child signs in with the family code + PIN (or a parent
  hands over the device), which mints an opaque token stored as an HMAC in `child_session` and set as
  the `cq_child_session` httpOnly cookie. Details and open product decisions:
  [docs/architecture/CHILD_AUTHENTICATION.md](docs/architecture/CHILD_AUTHENTICATION.md).
- **Contexts**: `getParentContext()` resolves the user's active family membership (role OWNER or
  GUARDIAN); `getChildContext()` resolves the child session. They are distinct TypeScript types, so a
  service that needs a `ParentContext` cannot be called with a child session.
- **Enforcement points**: `src/proxy.ts` is an optimistic cookie check only. Layouts
  (`(parent)/parent/layout.tsx`, `(child)/child/layout.tsx`) and every server action re-resolve the
  context. Services call `assertFamilyScope`, `assertPermission`, `requireChildInFamily` and always
  query with `familyId` in the `where` clause.
- **Roles**: OWNER manages family settings and members; GUARDIAN manages children, tasks, approvals,
  rewards. Children can only submit their own occurrences/steps, play, and claim their own rewards.

## Phase 2 services

| Service                   | Responsibility                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `maintenance.service`     | The scheduled job body: 7-day materialization per family, goal-assignment expiry, completion retry, dev-outbox pruning (idempotent).         |
| `history.service`         | Cursor-paginated verified-completion history for parents (per child, date range) and children (own rows only).                               |
| `invitation.service`      | Guardian invitations (hashed single-use tokens, expiry, email binding, row-locked accept), guardian removal. OWNER only.                     |
| `task.service` (extended) | Edit/archive tasks, preset → library, edit assignment schedule/points/due time/end date. Never rewrites generated occurrences.               |
| `routine.service` (ext.)  | Edit/archive routines, reorder steps, optional steps, assignment editing, **completion-window enforcement** (`features/routines/window.ts`). |
| `child.service` (ext.)    | Profile/avatar edit, archive/restore, PIN reset (also revokes sessions). Archived children get no new occurrences or runs.                   |

## Phase 3 services

| Service                   | Responsibility                                                                                                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notification.service`    | In-app notifications (ADR 0009): `notifyParents`/`notifyChild` (idempotent via `dedupeKey`), cursor-paginated `listNotifications`, `countUnread`, `markNotificationsRead`. Written inside the producing transaction. |
| `approval.service` (ext.) | Parent note on approve/reject (visible to the child), notifications, `bulkApprove` (one transaction per item through the single-item path, per-item results, audit per item).                                        |
| `goal.service` (ext.)     | `updateGoal`, `setGoalArchived`, `updateGoalAssignment`, `repairGoalAssignment`/`repairGoalProgress` (replay from `goal_contribution`), shared `awardGoalCompletion`. Rules: `docs/gameplay/GOALS.md`.               |
| `reward.service` (ext.)   | Catalogue (`create/update/setRewardActive/listRewardDefinitions`), redemptions that reserve points and stock at request time and refund on denial (ADR 0010).                                                        |
| `achievement.service`     | Child gallery: earned vs locked; locked entries expose only a `hint`, never the description or criteria.                                                                                                             |
| `audit.service` (ext.)    | `listAuditLog` for OWNER/GUARDIAN: family-scoped, cursor pagination, action-prefix and local date-range filters, readable summaries from `features/audit/summary.ts` (pure).                                         |

### Phase 3 follow-ups and Phase 4 start

- `routine.service` (ext.): `addRoutineStep`, `removeRoutineStep` (steps are retired, never deleted; unfinished runs from today on are reconciled, lock order routine → run; ADR 0011). `approval.service.removeRoutineStepAndSettle` auto-approves runs completed by a removal under `AUTO_APPROVE`.
- `reward.service` (ext.): `cancelRedemption` (child cancels an own `REQUESTED` request; ADR 0010 lock order child → reward).
- `notification.service` (ext.): `pruneNotifications`, called from the maintenance job (read 90 d / unread 180 d, bounded batches).
- `inventory.service` (ext.): `listShopItems`, `loadShopContext`; `purchaseItem` enforces the pure rules in `src/features/shop/shop-state.ts` (ADR 0012).
- `src/lib/utils/dates.ts`: `formatLocalDateTime` for household-local timestamps.

### Home Port slice

- `crew-camp.service`: `getCrewCamp` (own wearable items by slot, ownership re-checked on read) and `equipCosmetic` (lock child → re-read progress → check ownership and `config.slot` → write `{ equipped }` into `child_adventure_progress.state`; ADR 0013). State schema: `src/game/schemas/adventure-state.ts`; pure helpers: `src/features/adventures/crew-camp.ts`.
- `location.service`: `getLocationStatus` / `visitLocation` — one-time item reward at a configured place, `requiresItemKey` gate, `grantItem` with `sourceKeys.locationItem` and source type `LOCATION_REWARD` (ADR 0014).
- `adventure.service.getAdventureState` now also returns each quest's `rewards` and each chapter's `hint`. The quest board (`src/features/adventures/quest-board.ts`, pure) only filters that state; it has no tables or writes.
- Pure engine modules: `src/game/engine/dialogue.ts` (situation and line selection over engine state, rotating by household-local date) and `lighthouse.ts` (hint of the current chapter). Authored text lives in `src/game/themes/pirate/dialogue.ts` and chapter `config.hint`.
- Child routes: `/child/port` (hub with Pip), `/child/port/quest-board`, `/child/port/crew-camp`, `/child/port/lighthouse`, `/child/port/hidden-cove`; reachable from the "More" menu.

## Service relationships and the approval pipeline

```mermaid
sequenceDiagram
  participant Child
  participant Parent
  participant Approval as approval.service
  participant Pipeline as progression.service
  participant DB
  Child->>Approval: submitOccurrence (child ctx)
  Approval->>DB: tx: lock occurrence, upsert submission, status=SUBMITTED
  Note over Approval: AUTO_APPROVE policy → approve in same tx (reviewer = system)
  Parent->>Approval: reviewOccurrence APPROVED (parent ctx)
  Approval->>DB: tx: lock occurrence FOR UPDATE; if already APPROVED return existing completion
  Approval->>DB: create ParentReview + ActivityCompletion(PENDING) + AuditLog
  Approval->>Pipeline: processCompletion(completionId)
  Pipeline->>DB: tx: lock child row; re-check PROCESSED
  Pipeline->>DB: ledger POINTS (sourceKey activity:id:POINTS)
  Pipeline->>DB: ledger COINS/XP drip if adventure active
  Pipeline->>DB: goal contributions (unique per assignment+completion), goal completion + reward
  Pipeline->>DB: quest contributions, item grants, quest/chapter completion, chapter unlocks
  Pipeline->>DB: achievements
  Pipeline->>DB: completion.processingStatus = PROCESSED
```

- Approval and downstream processing are **two transactions**. The first makes the approval durable;
  the second is idempotent and resumable (`reprocessPendingCompletions`). A crash between them leaves a
  `PENDING` completion that is safely retried; a crash inside the pipeline rolls it back entirely.
- Concurrency: the occurrence row is locked `FOR UPDATE` during approval and the child row is locked
  during the pipeline, so parallel approvals serialize. Unique constraints are the backstop.

## Adventure engine architecture

- **Content is data.** An adventure is a validated `AdventureDefinition` (chapters → quests →
  objectives, puzzles, items, achievements). The seed writes it to `adventure*`, `quest_*`,
  `puzzle_definition`, `item_definition`, `achievement_definition`.
- **Progress is per child** (`child_adventure_progress`, `child_chapter_progress`, `quest_progress`,
  `objective_progress`, `quest_contribution`, `puzzle_attempt`, `child_inventory_item`, `inventory_grant`).
- **Rules are generic**: objectives declare eligibility (`sourceTypes`, `categories`) and an optional
  per-progress item grant; chapters declare unlock requirements (`CHAPTER_COMPLETED`, `ITEM`,
  `QUEST_COMPLETED`) and completion requirements (`requiresQuestKeys`) plus a reward bundle. The engine
  evaluates these without knowing anything pirate-specific. Adding a Space theme is a new folder under
  `src/game/themes` plus assets.
- **Rendering**: React + CSS + SVG/images. Artwork is addressed through an asset manifest; markers and
  scene hotspots use percent coordinates and data-driven state (locked / unlocked / current / completed).

More: [docs/gameplay/GAME_ENGINE.md](docs/gameplay/GAME_ENGINE.md),
[docs/gameplay/PIRATE_ADVENTURE.md](docs/gameplay/PIRATE_ADVENTURE.md).

## State management

- Server state is the source of truth and is read by server components on each request.
- Mutations go through server actions returning `ActionResult<T>`; `ActionForm` shows errors/toasts
  and `revalidatePath` refreshes the view.
- Ephemeral client state (puzzle taps, dialog open/closed) stays in component state. Zustand is
  reserved for the richer game scenes in Phase 4 (animation/UI state only, never rewards).

## Error handling

- Services throw `AppError(code, message, details?)`; codes map to HTTP statuses.
- `runAction` converts errors into `ActionResult` and never leaks internals (unexpected errors become a
  generic message and are logged server-side).
- Zod failures become `VALIDATION` errors with per-field details.
- Next.js navigation errors (`redirect`, `notFound`) pass through untouched.

## Security boundaries

- Browser code never receives database credentials, service keys or another family's data.
- `server-only` guards Next-specific auth modules; services are framework-agnostic but only run server-side.
- Security headers are set in `next.config.ts`; CSP is deferred until the asset/CDN strategy is fixed.
- Sensitive parent/reward actions write `audit_log` rows in the same transaction.
- See [docs/development/SECURITY.md](docs/development/SECURITY.md) and
  [docs/development/PRIVACY.md](docs/development/PRIVACY.md).

## Scalability considerations (planned)

- Occurrence/run materialization, goal expiry and completion retry run in the hourly Vercel Cron job
  (`/api/cron/maintenance` → `maintenance.service.ts`, ADR 0007). Pages only create _today's_ rows as a safety net.
- All hot queries are covered by composite indexes on `(familyId, childId, localDate)` and status.
- Activity history and ledgers are cursor-paginated (`listLedger`).
- Per-child row locking bounds contention to one household member; no global locks.
- Game assets are lazy-loaded per chapter; the world map loads one background image.
- Multi-tenancy is by `familyId`; moving to RLS or schema-per-tenant is not planned for the MVP.

## Architecture decision records

See `docs/architecture/adr/`. Phase 3 added 0009 (in-app notifications) and 0010 (reward reservation on request).
