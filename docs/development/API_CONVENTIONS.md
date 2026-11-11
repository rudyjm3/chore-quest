# API conventions

## Server actions (default for mutations)

```ts
"use server";
export async function createTaskAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext(); // 1. who
    const input = parseOrThrow(createTaskSchema, {
      ...formToObject(formData),
      familyId: ctx.familyId,
    }); // 2. validate
    const task = await createTask(prisma, ctx, input); // 3. service (authorizes + transacts)
    revalidatePath("/parent/tasks"); // 4. refresh
    return { taskId: task.id }; // 5. minimal payload
  });
}
```

- Signature `(prev, formData)` so forms can use `useActionState` via `ActionForm`.
- Always return `ActionResult<T>`; never throw to the client except Next navigation errors.
- `familyId` comes from the context, never from the client, unless it is cross-checked with
  `assertFamilyScope`.
- Child actions use `requireChildContext()` and services that scope by `childId`.

## Route handlers (external interfaces only)

Currently `/api/auth/[...all]` (Better Auth) and `/api/health`. Use route handlers for webhooks, cron
endpoints and third-party integrations; keep them thin and reuse services. JSON errors follow
`{ error: { code, message, details? } }` with the `AppError` status mapping.

## Errors

`AppError` codes: `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `VALIDATION` 400, `CONFLICT` 409,
`INVALID_STATE` 422, `RATE_LIMITED` 429, `INTERNAL` 500. Foreign records in another family return
`NOT_FOUND`, not `FORBIDDEN`, to avoid leaking existence.

## Pagination

Cursor-based on `id` with `take: limit + 1` (see `listLedger`). Inputs validated by `paginationSchema`
(max 100). Never return unbounded history.

## Dates

Inputs are `YYYY-MM-DD` local dates (`localDateSchema`) and `HH:mm` times (`timeOfDaySchema`); outputs
expose `localDate` strings via `dbToLocalDate` and ISO instants for timestamps.

## Idempotency

- Server-generated: completions, goal/quest contributions, ledger entries from pipeline steps.
- Client-generated keys where the client initiates a credit/debit: `parentAdjustment.idempotencyKey`,
  `purchaseItem.idempotencyKey` (8–128 chars). Replays return the original outcome.

## Transactions

`db.$transaction(async (tx) => …)` only where an invariant spans tables. Lock the aggregate row first
(`lockChildRow`, `SELECT … FOR UPDATE` on occurrences/runs). Never `Promise.all` inside a transaction.

## Logging

`log.info/warn/error(message, fields)` from `src/lib/logging.ts`; structured JSON, no secrets, ids only.
