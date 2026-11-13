# ADR 0009 — In-app notifications

Status: accepted (Phase 3)

## Context

Parents need to know when something is waiting for them (a submission, a reward request) and children need to see the outcome (approved,
sent back, reward answered) together with the parent's note. There is no email provider yet (ADR 0008) and no push channel, and children
under 13 must not be sent anything outside the app.

## Decision

- One table, `notification`, with `familyId`, **exactly one** recipient (`recipientUserId` for a parent or `recipientChildId` for a child;
  a CHECK enforces "one of the two"), a `kind` enum, a short `title`/`body`, an optional `entityType`/`entityId` so the UI can link to the
  screen, `readAt` and `createdAt`.
- Rows are written **in the same transaction** as the event they describe (submission, review, redemption request/resolve), by
  `notification.service`. Nothing is sent anywhere: the recipient reads their own rows.
- Parents are notified by fan-out to every active OWNER/GUARDIAN. Children are notified individually.
- Idempotency: a nullable `dedupeKey`, unique per recipient (`(recipientUserId, dedupeKey)` and `(recipientChildId, dedupeKey)`), written
  with `createMany({ skipDuplicates })` so a replayed event never produces a second notification and no unique violation aborts the
  surrounding transaction. Re-approving an already approved item does not notify again.
- Reads are cursor-paginated newest-first (`createdAt desc, id desc`) and always scoped by `familyId` plus the caller's own recipient id.
  Marking read only touches the caller's own rows and is idempotent.
- Content rules: titles/bodies contain the actor's first-name label and the chore/reward title the parent chose, plus the parent's note.
  A child's notification never mentions another child.
- Auto-approved work creates no notification (nothing for anyone to do, and the child already sees the result).

## Consequences

- Unread counts are one indexed `COUNT` per page load (layouts); at household scale that is cheap. There is no real-time push: a page
  shows new rows on the next navigation or refresh.
- A future email/push channel can read the same rows (a job selects unread rows older than N minutes) without changing producers.
- Notification rows are never edited, only marked read; retention is the same as the family's other history (cascade on family/child/user
  deletion).

## Retention (Phase 3 follow-up)

The hourly maintenance job (ADR 0007) calls `pruneNotifications`: read notifications older than 90 days and unread ones older than 180 days (by `createdAt`) are deleted in id-limited batches of 500, at most 20 batches per run (the next hourly run continues). It is family-neutral, idempotent, and reports `notificationsPruned` in the job summary. The windows are constants in `notification.service.ts`; there is deliberately no env override yet (it would need the full env-var checklist).
