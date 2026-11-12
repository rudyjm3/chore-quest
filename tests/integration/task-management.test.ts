import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  assignTask,
  createTaskFromPreset,
  ensureTaskOccurrences,
  updateAssignment,
  updateAssignmentStatus,
  updateTask,
} from "@/server/services/task.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import { createChildFixture, createFamilyFixture, createTaskFixture } from "../helpers/fixtures";

const db: PrismaClient = testDb();
beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

async function setup() {
  const f = await createFamilyFixture(db);
  const { child } = await createChildFixture(db, f.family.id);
  const task = await createTaskFixture(db, f.family.id, { points: 5 });
  const [assignment] = await assignTask(db, f.ctx, {
    familyId: f.family.id,
    taskId: task.id,
    childIds: [child.id],
    schedule: { frequency: "DAILY", daysOfWeek: [], startDate: "2026-11-10" },
  });
  await ensureTaskOccurrences(db, { familyId: f.family.id, from: "2026-11-10", to: "2026-11-12" });
  return { ...f, child, task, assignment };
}

describe("task and assignment management", () => {
  it("editing a task or assignment never rewrites generated occurrences", async () => {
    const { family, ctx, task, assignment } = await setup();
    const before = await db.taskOccurrence.findMany({ where: { familyId: family.id } });
    expect(before).toHaveLength(3);
    await updateTask(db, ctx, { familyId: family.id, taskId: task.id, points: 50 });
    await updateAssignment(db, ctx, {
      familyId: family.id,
      assignmentId: assignment.id,
      schedule: {
        frequency: "SPECIFIC_DAYS",
        daysOfWeek: [1],
        startDate: "2026-11-10",
        endDate: "2026-12-01",
        dueTime: "18:30",
      },
      pointsOverride: 9,
    });
    const after = await db.taskOccurrence.findMany({ where: { familyId: family.id } });
    expect(after.map((o) => [o.id, o.pointsSnapshot, o.dueAt])).toEqual(
      before.map((o) => [o.id, o.pointsSnapshot, o.dueAt]),
    );
    expect(after.every((o) => o.pointsSnapshot === 5)).toBe(true);
    // New days pick up the new rules: 2026-11-16 is a Monday.
    await ensureTaskOccurrences(db, { familyId: family.id, from: "2026-11-13", to: "2026-11-17" });
    const fresh = await db.taskOccurrence.findMany({
      where: { familyId: family.id, id: { notIn: before.map((o) => o.id) } },
    });
    expect(fresh).toHaveLength(1);
    expect(fresh[0].pointsSnapshot).toBe(9);
    expect(fresh[0].dueAt).not.toBeNull();
  });

  it("archived tasks stop generating; restore resumes; archived assignment stops", async () => {
    const { family, ctx, task, assignment } = await setup();
    await updateTask(db, ctx, { familyId: family.id, taskId: task.id, isArchived: true });
    expect(
      (
        await ensureTaskOccurrences(db, {
          familyId: family.id,
          from: "2026-11-13",
          to: "2026-11-14",
        })
      ).created,
    ).toBe(0);
    await updateTask(db, ctx, { familyId: family.id, taskId: task.id, isArchived: false });
    await updateAssignmentStatus(db, ctx, assignment.id, "ARCHIVED");
    expect(
      (
        await ensureTaskOccurrences(db, {
          familyId: family.id,
          from: "2026-11-13",
          to: "2026-11-14",
        })
      ).created,
    ).toBe(0);
    const audits = await db.auditLog.findMany({ where: { familyId: family.id } });
    expect(audits.map((a) => a.action)).toEqual(
      expect.arrayContaining(["task.archive", "task.restore", "task.assignment.archived"]),
    );
  });

  it("cannot edit another family's task or assignment", async () => {
    const a = await setup();
    const b = await createFamilyFixture(db);
    await expect(
      updateTask(db, b.ctx, { familyId: b.family.id, taskId: a.task.id, points: 1 }),
    ).rejects.toThrow(/not found/i);
    await expect(
      updateAssignment(db, b.ctx, {
        familyId: b.family.id,
        assignmentId: a.assignment.id,
        schedule: { frequency: "DAILY", daysOfWeek: [], startDate: "2026-11-10" },
      }),
    ).rejects.toThrow(/not found/i);
    await expect(updateAssignmentStatus(db, b.ctx, a.assignment.id, "PAUSED")).rejects.toThrow(
      /not found/i,
    );
  });

  it("adds a preset to the library with its defaults", async () => {
    const { family, ctx } = await createFamilyFixture(db);
    const preset = await db.taskPreset.findFirstOrThrow({ where: { isActive: true } });
    const task = await createTaskFromPreset(db, ctx, family.id, preset.key);
    expect(task.title).toBe(preset.title);
    expect(task.points).toBe(preset.defaultPoints);
    expect(task.presetId).toBe(preset.id);
    await expect(createTaskFromPreset(db, ctx, family.id, "nope")).rejects.toThrow(/not found/i);
  });
});
