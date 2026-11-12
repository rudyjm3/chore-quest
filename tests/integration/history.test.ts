import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { addDays, localDateToDb } from "@/lib/utils/dates";
import { HISTORY_MAX_PAGE_SIZE, listActivityHistory } from "@/server/services/history.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import { createChildFixture, createFamilyFixture, createTaskFixture } from "../helpers/fixtures";

const db: PrismaClient = testDb();
beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

/** `perDay` completions per day for `days` days ending 2026-11-10, for one child. */
async function seedHistory(familyId: string, childId: string, days: number, perDay: number) {
  const task = await createTaskFixture(db, familyId, { title: "Make Bed" });
  const assignment = await db.taskAssignment.create({
    data: { familyId, childId, taskId: task.id, startDate: localDateToDb("2026-01-01") },
  });
  let n = 0;
  for (let d = 0; d < days; d += 1) {
    const day = addDays("2026-11-10", -d);
    for (let k = 0; k < perDay; k += 1) {
      // one occurrence per (assignment, day) is unique, so use one assignment per extra slot
      const a =
        k === 0
          ? assignment
          : await db.taskAssignment.create({
              data: { familyId, childId, taskId: task.id, startDate: localDateToDb("2026-01-01") },
            });
      const occ = await db.taskOccurrence.create({
        data: {
          familyId,
          childId,
          assignmentId: a.id,
          localDate: localDateToDb(day),
          pointsSnapshot: 5,
        },
      });
      await db.activityCompletion.create({
        data: {
          familyId,
          childId,
          sourceType: "TASK_OCCURRENCE",
          taskOccurrenceId: occ.id,
          localDate: localDateToDb(day),
          completedAt: new Date(`${day}T15:00:00Z`),
          pointsAwarded: 5,
          taskId: task.id,
          processingStatus: "PROCESSED",
        },
      });
      n += 1;
    }
  }
  return n;
}

async function drain(params: Parameters<typeof listActivityHistory>[1]) {
  const ids: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const page = await listActivityHistory(db, { ...params, cursor, limit: 7 });
    ids.push(...page.items.map((i) => i.id));
    cursor = page.nextCursor;
    pages += 1;
  } while (cursor && pages < 50);
  return { ids, pages };
}

describe("activity history", () => {
  it("pages through every row exactly once, newest first, even with many rows per day", async () => {
    const { family } = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, family.id);
    const total = await seedHistory(family.id, child.id, 6, 4); // 24 rows, 4 per date
    const { ids, pages } = await drain({ familyId: family.id });
    expect(ids).toHaveLength(total);
    expect(new Set(ids).size).toBe(total);
    expect(pages).toBe(4);
    const first = await listActivityHistory(db, { familyId: family.id, limit: 3 });
    expect(first.items.map((i) => i.localDate)).toEqual(["2026-11-10", "2026-11-10", "2026-11-10"]);
    expect(first.items[0]).toMatchObject({ title: "Make Bed", kind: "TASK", points: 5 });
  });

  it("filters by child and date range", async () => {
    const { family } = await createFamilyFixture(db);
    const a = await createChildFixture(db, family.id, "A");
    const b = await createChildFixture(db, family.id, "B");
    await seedHistory(family.id, a.child.id, 5, 1);
    await seedHistory(family.id, b.child.id, 5, 1);
    const onlyA = await drain({ familyId: family.id, childId: a.child.id });
    expect(onlyA.ids).toHaveLength(5);
    const range = await drain({ familyId: family.id, from: "2026-11-08", to: "2026-11-09" });
    expect(range.ids).toHaveLength(4);
    await expect(
      listActivityHistory(db, { familyId: family.id, from: "2026-11-10", to: "2026-11-01" }),
    ).rejects.toThrow(/start date/i);
  });

  it("never leaks another family's rows or another child's rows to a child-scoped query", async () => {
    const f1 = await createFamilyFixture(db);
    const f2 = await createFamilyFixture(db);
    const kid1 = await createChildFixture(db, f1.family.id, "One");
    const sib = await createChildFixture(db, f1.family.id, "Sib");
    const kid2 = await createChildFixture(db, f2.family.id, "Two");
    await seedHistory(f1.family.id, kid1.child.id, 2, 1);
    await seedHistory(f1.family.id, sib.child.id, 3, 1);
    await seedHistory(f2.family.id, kid2.child.id, 4, 1);
    const mine = await listActivityHistory(db, { familyId: f1.family.id, childId: kid1.child.id });
    expect(mine.items).toHaveLength(2);
    expect(mine.items.every((i) => i.childId === kid1.child.id)).toBe(true);
    const family = await listActivityHistory(db, { familyId: f1.family.id });
    expect(family.items).toHaveLength(5);
    // A foreign child id is rejected outright.
    await expect(
      listActivityHistory(db, { familyId: f1.family.id, childId: kid2.child.id }),
    ).rejects.toThrow(/not found/i);
  });

  it("clamps the page size and treats a tampered cursor as the first page", async () => {
    const { family } = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, family.id);
    await seedHistory(family.id, child.id, HISTORY_MAX_PAGE_SIZE + 5, 1);
    const big = await listActivityHistory(db, { familyId: family.id, limit: 100_000 });
    expect(big.items).toHaveLength(HISTORY_MAX_PAGE_SIZE);
    expect(big.nextCursor).not.toBeNull();
    const tampered = await listActivityHistory(db, {
      familyId: family.id,
      cursor: "garbage",
      limit: 5,
    });
    expect(tampered.items[0].localDate).toBe("2026-11-10");
  });
});
