import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { localDateToDb } from "@/lib/utils/dates";

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

describe("database integrity", () => {
  it("rejects a child without a family (foreign key)", async () => {
    await expect(
      db.child.create({
        data: { familyId: "0193b2f0-0000-7000-8000-000000000000", displayName: "Ghost" },
      }),
    ).rejects.toThrow();
  });

  it("a user can only be a member of a family once", async () => {
    const { family, user } = await createFamilyFixture(db);
    await expect(
      db.familyMember.create({ data: { familyId: family.id, userId: user.id } }),
    ).rejects.toThrow(/Unique/);
  });

  it("an assignment has at most one occurrence per local date", async () => {
    const { family } = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, family.id);
    const task = await createTaskFixture(db, family.id);
    const { assignment } = await createOccurrenceFixture(db, {
      familyId: family.id,
      childId: child.id,
      taskId: task.id,
      localDate: "2026-11-10",
    });
    await expect(
      db.taskOccurrence.create({
        data: {
          familyId: family.id,
          assignmentId: assignment.id,
          childId: child.id,
          localDate: localDateToDb("2026-11-10"),
          pointsSnapshot: 5,
        },
      }),
    ).rejects.toThrow(/Unique/);
  });

  it("an activity completion must reference exactly one matching source (CHECK)", async () => {
    const { family } = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, family.id);
    await expect(
      db.activityCompletion.create({
        data: {
          familyId: family.id,
          childId: child.id,
          sourceType: "TASK_OCCURRENCE",
          localDate: localDateToDb("2026-11-10"),
          completedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it("an occurrence can be completed only once (unique source)", async () => {
    const { family } = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, family.id);
    const task = await createTaskFixture(db, family.id);
    const { occurrence } = await createOccurrenceFixture(db, {
      familyId: family.id,
      childId: child.id,
      taskId: task.id,
      localDate: "2026-11-10",
    });
    const data = {
      familyId: family.id,
      childId: child.id,
      sourceType: "TASK_OCCURRENCE" as const,
      taskOccurrenceId: occurrence.id,
      localDate: localDateToDb("2026-11-10"),
      completedAt: new Date(),
    };
    await db.activityCompletion.create({ data });
    await expect(db.activityCompletion.create({ data })).rejects.toThrow(/Unique/);
  });

  it("wallet balances and ledger amounts are constrained", async () => {
    const { family } = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, family.id);
    await expect(
      db.rewardWallet.create({
        data: { familyId: family.id, childId: child.id, currency: "POINTS", balance: -1 },
      }),
    ).rejects.toThrow();
    await expect(
      db.rewardLedgerEntry.create({
        data: {
          familyId: family.id,
          childId: child.id,
          currency: "POINTS",
          amount: 0,
          balanceAfter: 0,
          sourceType: "PARENT_ADJUSTMENT",
          sourceId: "x",
          sourceKey: "x",
        },
      }),
    ).rejects.toThrow();
  });

  it("days of week are constrained to 0..6", async () => {
    const { family } = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, family.id);
    const task = await createTaskFixture(db, family.id);
    await expect(
      db.taskAssignment.create({
        data: {
          familyId: family.id,
          taskId: task.id,
          childId: child.id,
          frequency: "SPECIFIC_DAYS",
          daysOfWeek: [7],
          startDate: localDateToDb("2026-11-10"),
        },
      }),
    ).rejects.toThrow();
  });

  it("deleting a family cascades household data but keeps reference data", async () => {
    const { family } = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, family.id);
    const task = await createTaskFixture(db, family.id);
    await createOccurrenceFixture(db, {
      familyId: family.id,
      childId: child.id,
      taskId: task.id,
      localDate: "2026-11-10",
    });
    await db.family.delete({ where: { id: family.id } });
    expect(await db.taskOccurrence.count()).toBe(0);
    expect(await db.child.count()).toBe(0);
    expect(await db.taskPreset.count()).toBeGreaterThan(0);
  });

  it("rolls back every write when a transaction fails", async () => {
    const { family } = await createFamilyFixture(db);
    await expect(
      db.$transaction(async (tx) => {
        await tx.child.create({ data: { familyId: family.id, displayName: "Temp" } });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await db.child.count({ where: { familyId: family.id } })).toBe(0);
  });
});

describe("family_invitation constraints (migration family_invitation_constraints)", () => {
  const base = (familyId: string, tokenHash: string) => ({
    familyId,
    email: "invitee@example.test",
    tokenHash,
    expiresAt: new Date(Date.now() + 86_400_000),
  });

  it("cannot invite someone as OWNER", async () => {
    const { family } = await createFamilyFixture(db);
    await expect(
      db.familyInvitation.create({ data: { ...base(family.id, "h1"), role: "OWNER" } }),
    ).rejects.toThrow(/guardian_only|check/i);
  });

  it("cannot be both accepted and revoked, and acceptance needs a user", async () => {
    const { family, user } = await createFamilyFixture(db);
    await expect(
      db.familyInvitation.create({
        data: {
          ...base(family.id, "h2"),
          acceptedAt: new Date(),
          acceptedById: user.id,
          revokedAt: new Date(),
        },
      }),
    ).rejects.toThrow(/single_outcome|check/i);
    await expect(
      db.familyInvitation.create({ data: { ...base(family.id, "h3"), acceptedAt: new Date() } }),
    ).rejects.toThrow(/accepted_has_user|check/i);
  });

  it("allows only one open invitation per family and email, but a new one after revoking", async () => {
    const { family } = await createFamilyFixture(db);
    const first = await db.familyInvitation.create({ data: base(family.id, "h4") });
    await expect(db.familyInvitation.create({ data: base(family.id, "h5") })).rejects.toThrow(
      /Unique/,
    );
    await db.familyInvitation.update({ where: { id: first.id }, data: { revokedAt: new Date() } });
    await expect(db.familyInvitation.create({ data: base(family.id, "h6") })).resolves.toBeTruthy();
  });

  it("token hashes are unique", async () => {
    const a = await createFamilyFixture(db);
    const b = await createFamilyFixture(db);
    await db.familyInvitation.create({ data: base(a.family.id, "same") });
    await expect(db.familyInvitation.create({ data: base(b.family.id, "same") })).rejects.toThrow(
      /Unique/,
    );
  });
});
