import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { reviewOccurrence } from "@/server/services/approval.service";
import {
  createChild,
  signInChild,
  startChildSessionAsParent,
} from "@/server/services/child.service";
import { resolveChildSession } from "@/lib/auth/child-session";
import { parentAdjustment } from "@/server/services/reward.service";
import {
  assignTask,
  createTask,
  ensureTaskOccurrences,
  listOccurrencesForChild,
} from "@/server/services/task.service";

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

describe("cross-family isolation", () => {
  it("a parent cannot approve, assign to, or adjust another family's child", async () => {
    const a = await createFamilyFixture(db, { name: "A" });
    const b = await createFamilyFixture(db, { name: "B" });
    const { child: childB } = await createChildFixture(db, b.family.id, "B kid");
    const taskB = await createTaskFixture(db, b.family.id);
    const { occurrence } = await createOccurrenceFixture(db, {
      familyId: b.family.id,
      childId: childB.id,
      taskId: taskB.id,
      localDate: "2026-11-10",
    });

    // Wrong familyId in the input → forbidden before any lookup.
    await expect(
      reviewOccurrence(db, a.ctx, {
        familyId: b.family.id,
        occurrenceId: occurrence.id,
        decision: "APPROVED",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Own familyId but someone else's record → not found (no existence leak).
    await expect(
      reviewOccurrence(db, a.ctx, {
        familyId: a.family.id,
        occurrenceId: occurrence.id,
        decision: "APPROVED",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const taskA = await createTask(db, a.ctx, {
      familyId: a.family.id,
      title: "A task",
      category: "CHORE",
      points: 5,
      approvalPolicy: "PARENT_REVIEW",
    });
    await expect(
      assignTask(db, a.ctx, {
        familyId: a.family.id,
        taskId: taskA.id,
        childIds: [childB.id],
        schedule: { frequency: "DAILY", daysOfWeek: [], startDate: "2026-11-10" },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      parentAdjustment(db, a.ctx, {
        familyId: a.family.id,
        childId: childB.id,
        currency: "POINTS",
        amount: 5,
        reason: "x",
        idempotencyKey: "abcdefgh",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(startChildSessionAsParent(db, a.ctx, childB.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(
      (
        await listOccurrencesForChild(db, {
          familyId: a.family.id,
          childId: childB.id,
          from: "2026-11-01",
          to: "2026-11-30",
        })
      ).length,
    ).toBe(0);
  });

  it("guardians cannot change family settings but can manage children", async () => {
    const { family } = await createFamilyFixture(db);
    const guardianUser = await db.user.create({
      data: { name: "G", email: `g-${Date.now()}@example.test` },
    });
    const membership = await db.familyMember.create({
      data: { familyId: family.id, userId: guardianUser.id, role: "GUARDIAN" },
    });
    const guardianCtx = {
      kind: "parent" as const,
      userId: guardianUser.id,
      userName: "G",
      familyId: family.id,
      familyName: family.name,
      timezone: family.timezone,
      weekStartsOn: 1,
      role: "GUARDIAN" as const,
      membershipId: membership.id,
    };
    const child = await createChild(db, guardianCtx, {
      familyId: family.id,
      displayName: "New kid",
    });
    expect(child.familyId).toBe(family.id);
    const { updateFamilySettings } = await import("@/server/services/family.service");
    await expect(
      updateFamilySettings(db, guardianCtx, { familyId: family.id, name: "Renamed" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("child sign-in requires the right family code and PIN, locks after repeated failures, and sessions resolve", async () => {
    const { family } = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, family.id, "Ava", "2468");
    await expect(
      signInChild(db, { familyCode: "ZZZZZZ", childId: child.id, pin: "2468" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    for (let i = 0; i < 5; i += 1) {
      await expect(
        signInChild(db, { familyCode: family.childLoginCode, childId: child.id, pin: "0000" }),
      ).rejects.toThrow(AppError);
    }
    await expect(
      signInChild(db, { familyCode: family.childLoginCode, childId: child.id, pin: "2468" }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await db.childCredential.update({
      where: { childId: child.id },
      data: { lockedUntil: null, failedAttempts: 0 },
    });
    const { token } = await signInChild(db, {
      familyCode: family.childLoginCode,
      childId: child.id,
      pin: "2468",
    });
    const session = await resolveChildSession(db, token);
    expect(session?.childId).toBe(child.id);
    expect(await resolveChildSession(db, "not-a-real-token")).toBeNull();
    expect(await db.childSession.count({ where: { tokenHash: token } })).toBe(0); // raw token never stored
  });

  it("occurrence generation is idempotent and family scoped", async () => {
    const a = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, a.family.id);
    const task = await createTask(db, a.ctx, {
      familyId: a.family.id,
      title: "Daily",
      category: "CHORE",
      points: 4,
      approvalPolicy: "PARENT_REVIEW",
    });
    await assignTask(db, a.ctx, {
      familyId: a.family.id,
      taskId: task.id,
      childIds: [child.id],
      schedule: { frequency: "SPECIFIC_DAYS", daysOfWeek: [1, 3, 5], startDate: "2026-11-09" },
    });
    const first = await ensureTaskOccurrences(db, {
      familyId: a.family.id,
      from: "2026-11-09",
      to: "2026-11-15",
    });
    const second = await ensureTaskOccurrences(db, {
      familyId: a.family.id,
      from: "2026-11-09",
      to: "2026-11-15",
    });
    expect(first.created).toBe(3);
    expect(second.created).toBe(0);
    expect(await db.taskOccurrence.count({ where: { familyId: a.family.id } })).toBe(3);
  });
});
