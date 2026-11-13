import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  bulkApprove,
  reviewOccurrence,
  reviewRoutineRun,
  submitOccurrence,
} from "@/server/services/approval.service";
import {
  countUnread,
  listNotifications,
  markNotificationsRead,
  notifyChild,
  notifyParents,
} from "@/server/services/notification.service";
import { getWallets } from "@/server/services/reward.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import {
  createChildFixture,
  createFamilyFixture,
  createOccurrenceFixture,
  createTaskFixture,
} from "../helpers/fixtures";

const db = testDb();

beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

async function submitted(setup: Awaited<ReturnType<typeof world>>, title = "Make Bed") {
  const task = await createTaskFixture(db, setup.family.id, { title });
  const { occurrence } = await createOccurrenceFixture(db, {
    familyId: setup.family.id,
    childId: setup.kid.child.id,
    taskId: task.id,
    localDate: "2026-11-10",
  });
  await submitOccurrence(db, setup.kid.ctx, occurrence.id, "all done");
  return occurrence;
}

async function world() {
  const { family, ctx, user } = await createFamilyFixture(db);
  const kid = await createChildFixture(db, family.id);
  return { family, ctx, user, kid };
}

describe("notifications", () => {
  it("a submission notifies every approving parent; approve/reject notify the child with the note", async () => {
    const w = await world();
    const guardianUser = await db.user.create({
      data: { name: "Guardian", email: `g-${Date.now()}@example.test` },
    });
    await db.familyMember.create({
      data: { familyId: w.family.id, userId: guardianUser.id, role: "GUARDIAN" },
    });
    const occurrence = await submitted(w);

    const parentNotes = await db.notification.findMany({
      where: { familyId: w.family.id, kind: "SUBMISSION_PENDING" },
    });
    expect(parentNotes.map((n) => n.recipientUserId).sort()).toEqual(
      [w.user.id, guardianUser.id].sort(),
    );
    expect(parentNotes[0].title).toContain("Kid finished");

    await reviewOccurrence(db, w.ctx, {
      familyId: w.family.id,
      occurrenceId: occurrence.id,
      decision: "REJECTED",
      note: "Under the pillow too, please",
    });
    const rejected = await db.notification.findFirstOrThrow({
      where: { recipientChildId: w.kid.child.id, kind: "SUBMISSION_REJECTED" },
    });
    expect(rejected.body).toBe("Under the pillow too, please");

    await submitOccurrence(db, w.kid.ctx, occurrence.id);
    await reviewOccurrence(db, w.ctx, {
      familyId: w.family.id,
      occurrenceId: occurrence.id,
      decision: "APPROVED",
      note: "Nice!",
    });
    // A repeated approval does not notify twice.
    await reviewOccurrence(db, w.ctx, {
      familyId: w.family.id,
      occurrenceId: occurrence.id,
      decision: "APPROVED",
    });
    const approved = await db.notification.findMany({
      where: { recipientChildId: w.kid.child.id, kind: "SUBMISSION_APPROVED" },
    });
    expect(approved).toHaveLength(1);
    expect(approved[0].body).toBe("Nice!");
    const review = await db.parentReview.findFirstOrThrow({
      where: { submission: { occurrenceId: occurrence.id } },
    });
    expect(review.note).toBe("Nice!");
  });

  it("a notification is private to its recipient and family", async () => {
    const a = await world();
    const b = await world();
    const sibling = await createChildFixture(db, a.family.id, "Sibling");
    await notifyChild(db, a.family.id, a.kid.child.id, { kind: "SUBMISSION_APPROVED", title: "A" });
    await notifyParents(db, a.family.id, { kind: "SUBMISSION_PENDING", title: "P" });

    expect((await listNotifications(db, a.kid.ctx)).items.map((n) => n.title)).toEqual(["A"]);
    expect((await listNotifications(db, sibling.ctx)).items).toEqual([]);
    expect((await listNotifications(db, b.ctx)).items).toEqual([]);
    expect((await listNotifications(db, a.ctx)).items.map((n) => n.title)).toEqual(["P"]);

    // Marking read only touches the caller's own rows.
    const mine = (await listNotifications(db, a.kid.ctx)).items[0];
    expect(await markNotificationsRead(db, sibling.ctx, [mine.id])).toEqual({ updated: 0 });
    expect(await countUnread(db, a.kid.ctx)).toBe(1);
    expect(await markNotificationsRead(db, a.kid.ctx, [mine.id])).toEqual({ updated: 1 });
    expect(await countUnread(db, a.kid.ctx)).toBe(0);
    expect(await markNotificationsRead(db, a.kid.ctx, [mine.id])).toEqual({ updated: 0 });
  });

  it("dedupe keys make fan-out idempotent", async () => {
    const w = await world();
    const content = { kind: "SUBMISSION_PENDING" as const, title: "x", dedupeKey: "same" };
    expect(await notifyParents(db, w.family.id, content)).toBe(1);
    expect(await notifyParents(db, w.family.id, content)).toBe(0);
    expect(await db.notification.count({ where: { familyId: w.family.id } })).toBe(1);
  });

  it("paginates newest-first with a cursor and filters unread", async () => {
    const w = await world();
    for (let i = 1; i <= 7; i += 1) {
      await notifyChild(db, w.family.id, w.kid.child.id, {
        kind: "SUBMISSION_APPROVED",
        title: `n${i}`,
      });
    }
    const first = await listNotifications(db, w.kid.ctx, { limit: 3 });
    expect(first.items.map((n) => n.title)).toEqual(["n7", "n6", "n5"]);
    const second = await listNotifications(db, w.kid.ctx, { limit: 3, cursor: first.nextCursor! });
    expect(second.items.map((n) => n.title)).toEqual(["n4", "n3", "n2"]);
    const third = await listNotifications(db, w.kid.ctx, { limit: 3, cursor: second.nextCursor! });
    expect(third.items.map((n) => n.title)).toEqual(["n1"]);
    expect(third.nextCursor).toBeNull();
    await markNotificationsRead(db, w.kid.ctx, [first.items[0].id]);
    expect(
      (await listNotifications(db, w.kid.ctx, { unreadOnly: true, limit: 50 })).items,
    ).toHaveLength(6);
  });

  it("the database requires exactly one recipient", async () => {
    const w = await world();
    await expect(
      db.notification.create({
        data: { familyId: w.family.id, kind: "SUBMISSION_PENDING", title: "nobody" },
      }),
    ).rejects.toThrow(/one_recipient/);
    await expect(
      db.notification.create({
        data: {
          familyId: w.family.id,
          kind: "SUBMISSION_PENDING",
          title: "both",
          recipientUserId: w.user.id,
          recipientChildId: w.kid.child.id,
        },
      }),
    ).rejects.toThrow(/one_recipient/);
  });
});

describe("bulk approve", () => {
  it("approves each item in its own transaction, audits each, and reports partial failures", async () => {
    const w = await world();
    const o1 = await submitted(w, "One");
    const o2 = await submitted(w, "Two");
    const other = await world();
    const foreign = await submitted(other, "Foreign");
    const missing = "0193b2f0-0000-7000-8000-000000000001";

    const results = await bulkApprove(db, w.ctx, {
      familyId: w.family.id,
      note: "Great week",
      items: [
        { kind: "occurrence", id: o1.id },
        { kind: "occurrence", id: foreign.id }, // other family: fails
        { kind: "occurrence", id: missing }, // unknown: fails
        { kind: "occurrence", id: o2.id },
        { kind: "occurrence", id: o1.id }, // duplicate in the batch is ignored
      ],
    });
    expect(results.map((r) => r.ok)).toEqual([true, false, false, true]);
    expect(results[1]).toMatchObject({ ok: false, code: "NOT_FOUND" });

    expect((await getWallets(db, w.kid.child.id)).POINTS).toBe(10);
    expect(
      await db.auditLog.count({ where: { familyId: w.family.id, action: "approval.approve" } }),
    ).toBe(2);
    expect(await db.activityCompletion.count({ where: { childId: other.kid.child.id } })).toBe(0);

    // Re-sending the same batch is safe: nothing is paid twice.
    const again = await bulkApprove(db, w.ctx, {
      familyId: w.family.id,
      items: [
        { kind: "occurrence", id: o1.id },
        { kind: "occurrence", id: o2.id },
      ],
    });
    expect(again).toMatchObject([
      { ok: true, alreadyApproved: true },
      { ok: true, alreadyApproved: true },
    ]);
    expect((await getWallets(db, w.kid.child.id)).POINTS).toBe(10);
  });

  it("handles routine runs and enforces size and role limits", async () => {
    const w = await world();
    await expect(bulkApprove(db, w.ctx, { familyId: w.family.id, items: [] })).rejects.toThrow(
      /at least one/,
    );
    await expect(
      bulkApprove(
        db,
        { ...w.ctx, role: "GUARDIAN" },
        {
          familyId: "0193b2f0-0000-7000-8000-000000000009",
          items: [{ kind: "routine_run", id: "0193b2f0-0000-7000-8000-000000000001" }],
        },
      ),
    ).rejects.toThrow(/another family/);
    const [r] = await bulkApprove(db, w.ctx, {
      familyId: w.family.id,
      items: [{ kind: "routine_run", id: "0193b2f0-0000-7000-8000-000000000001" }],
    });
    expect(r).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("stores a routine-run review note the child can read", async () => {
    const w = await world();
    const routine = await db.routine.create({
      data: { familyId: w.family.id, name: "Morning" },
    });
    const assignment = await db.routineAssignment.create({
      data: {
        familyId: w.family.id,
        routineId: routine.id,
        childId: w.kid.child.id,
        startDate: new Date("2026-11-01"),
      },
    });
    const run = await db.routineRun.create({
      data: {
        familyId: w.family.id,
        assignmentId: assignment.id,
        childId: w.kid.child.id,
        localDate: new Date("2026-11-10"),
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });
    await reviewRoutineRun(db, w.ctx, {
      familyId: w.family.id,
      runId: run.id,
      decision: "REJECTED",
      note: "Brush longer",
    });
    expect((await db.routineRun.findUniqueOrThrow({ where: { id: run.id } })).reviewNote).toBe(
      "Brush longer",
    );
    const note = await db.notification.findFirstOrThrow({
      where: { recipientChildId: w.kid.child.id },
    });
    expect(note.body).toBe("Brush longer");
  });
});
