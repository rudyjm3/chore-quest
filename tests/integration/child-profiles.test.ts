import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { issueChildSession } from "@/lib/auth/child-session";
import { updateChildProfileSchema } from "@/lib/validation/families";
import {
  archiveChild,
  lookupFamilyForChildSignIn,
  restoreChild,
  setChildPin,
  updateChildProfile,
} from "@/server/services/child.service";
import { rotateFamilyCode } from "@/server/services/family.service";
import { assignRoutine, createRoutine, ensureRoutineRuns } from "@/server/services/routine.service";
import { assignTask, ensureTaskOccurrences } from "@/server/services/task.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import { createChildFixture, createFamilyFixture, createTaskFixture } from "../helpers/fixtures";

const db: PrismaClient = testDb();
beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

describe("child profiles", () => {
  it("updates name and avatar; rejects an avatar outside the fixed set and other families", async () => {
    const a = await createFamilyFixture(db);
    const b = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, a.family.id);
    const updated = await updateChildProfile(db, a.ctx, {
      familyId: a.family.id,
      childId: child.id,
      displayName: "Zed",
      avatarKey: "avatar.fox",
    });
    expect(updated).toMatchObject({ displayName: "Zed", avatarKey: "avatar.fox" });
    expect(
      updateChildProfileSchema.safeParse({
        familyId: a.family.id,
        childId: child.id,
        displayName: "Zed",
        avatarKey: "http://evil/x.png",
      }).success,
    ).toBe(false);
    await expect(
      updateChildProfile(db, b.ctx, {
        familyId: b.family.id,
        childId: child.id,
        displayName: "Hax",
        avatarKey: null,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("archive revokes sessions, stops new work and hides from sign-in; restore brings it back", async () => {
    const { family, ctx } = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, family.id);
    const task = await createTaskFixture(db, family.id);
    await assignTask(db, ctx, {
      familyId: family.id,
      taskId: task.id,
      childIds: [child.id],
      schedule: { frequency: "DAILY", daysOfWeek: [], startDate: "2026-11-10" },
    });
    const routine = await createRoutine(db, ctx, {
      familyId: family.id,
      name: "R",
      taskIds: [task.id],
    });
    await assignRoutine(db, ctx, {
      familyId: family.id,
      routineId: routine.id,
      childId: child.id,
      bonusPoints: 0,
      approvalPolicy: "PARENT_REVIEW",
      schedule: { frequency: "DAILY", daysOfWeek: [], startDate: "2026-11-10" },
    });
    await issueChildSession(db, { familyId: family.id, childId: child.id, ttlMinutes: 60 });
    await archiveChild(db, ctx, child.id);
    expect(await db.childSession.count({ where: { childId: child.id, revokedAt: null } })).toBe(0);
    const range = { familyId: family.id, from: "2026-11-10", to: "2026-11-12" };
    expect((await ensureTaskOccurrences(db, range)).created).toBe(0);
    expect((await ensureRoutineRuns(db, range)).created).toBe(0);
    expect((await lookupFamilyForChildSignIn(db, family.childLoginCode))?.children).toHaveLength(0);
    await restoreChild(db, ctx, child.id);
    expect((await ensureTaskOccurrences(db, range)).created).toBe(3);
    await expect(restoreChild(db, ctx, child.id)).rejects.toThrow(/not archived/i);
  });

  it("PIN reset unlocks the child and signs them out everywhere", async () => {
    const { family, ctx } = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, family.id);
    await db.childCredential.update({
      where: { childId: child.id },
      data: { failedAttempts: 5, lockedUntil: new Date(Date.now() + 600_000) },
    });
    await issueChildSession(db, { familyId: family.id, childId: child.id, ttlMinutes: 60 });
    await setChildPin(db, ctx, child.id, "9876");
    const cred = await db.childCredential.findUniqueOrThrow({ where: { childId: child.id } });
    expect(cred).toMatchObject({ failedAttempts: 0, lockedUntil: null });
    expect(await db.childSession.count({ where: { childId: child.id, revokedAt: null } })).toBe(0);
  });

  it("only the OWNER can rotate the family code; the old code stops working", async () => {
    const { family, ctx } = await createFamilyFixture(db);
    const guardian = { ...ctx, role: "GUARDIAN" as const };
    await expect(rotateFamilyCode(db, guardian)).rejects.toThrow();
    const code = await rotateFamilyCode(db, ctx);
    expect(code).not.toBe(family.childLoginCode);
    expect(await lookupFamilyForChildSignIn(db, family.childLoginCode)).toBeNull();
    expect((await lookupFamilyForChildSignIn(db, code))?.id).toBe(family.id);
    expect(
      await db.auditLog.count({ where: { familyId: family.id, action: "family.code.rotate" } }),
    ).toBe(1);
  });
});
