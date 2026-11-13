import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { listAchievementGallery } from "@/server/services/achievement.service";
import { listAuditLog, recordAudit } from "@/server/services/audit.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import { createChildFixture, createFamilyFixture } from "../helpers/fixtures";

const db = testDb();

beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

async function seedAudit(familyId: string, userId: string, actions: string[]) {
  for (const action of actions) {
    await recordAudit(db, {
      familyId,
      actorType: "PARENT",
      actorUserId: userId,
      action,
      entityType: "X",
      entityId: "1",
      metadata: { title: "Secret <b>x</b>", secretToken: "should-never-render", costPoints: 5 },
    });
  }
}

describe("audit log view", () => {
  it("is family-scoped, newest first, cursor-paginated and never exposes raw metadata", async () => {
    const a = await createFamilyFixture(db);
    const b = await createFamilyFixture(db);
    await seedAudit(a.family.id, a.user.id, [
      "reward.create",
      "reward.adjust",
      "goal.create",
      "approval.approve",
      "unknown.action",
    ]);
    await seedAudit(b.family.id, b.user.id, ["reward.create"]);

    const page1 = await listAuditLog(db, a.ctx, { limit: 3 });
    expect(page1.entries.map((e) => e.action)).toEqual([
      "unknown.action",
      "approval.approve",
      "goal.create",
    ]);
    const page2 = await listAuditLog(db, a.ctx, { limit: 3, cursor: page1.nextCursor! });
    expect(page2.entries.map((e) => e.action)).toEqual(["reward.adjust", "reward.create"]);
    expect(page2.nextCursor).toBeNull();

    const all = [...page1.entries, ...page2.entries];
    const text = JSON.stringify(all);
    expect(text).not.toContain("should-never-render");
    expect(text).not.toContain("secretToken");
    expect(all.find((e) => e.action === "unknown.action")?.summary).toBe("Unknown action");
    expect(all.find((e) => e.action === "reward.create")?.summary).toContain("Added reward");
    expect(all[0].actorLabel).toBe(a.user.name);
  });

  it("filters by action prefix (not substring) and by local date range", async () => {
    const a = await createFamilyFixture(db, { timezone: "America/New_York" });
    await seedAudit(a.family.id, a.user.id, ["reward.create", "reward.adjust", "goal.create"]);
    await seedAudit(a.family.id, a.user.id, ["rewardx.other"]);

    const rewards = await listAuditLog(db, a.ctx, { prefix: "reward" });
    expect(rewards.entries.map((e) => e.action).sort()).toEqual(["reward.adjust", "reward.create"]);
    const exact = await listAuditLog(db, a.ctx, { prefix: "reward.adjust" });
    expect(exact.entries).toHaveLength(1);

    await db.auditLog.updateMany({
      where: { familyId: a.family.id, action: "goal.create" },
      data: { createdAt: new Date("2026-01-15T12:00:00Z") },
    });
    const ranged = await listAuditLog(db, a.ctx, { from: "2026-01-15", to: "2026-01-15" });
    expect(ranged.entries.map((e) => e.action)).toEqual(["goal.create"]);
    const none = await listAuditLog(db, a.ctx, { from: "2026-01-16", to: "2026-01-20" });
    expect(none.entries).toEqual([]);
    await expect(listAuditLog(db, a.ctx, { prefix: "re ward%" })).rejects.toThrow(/filter/);
  });
});

describe("achievement gallery", () => {
  it("shows a hint (never the description or criteria) until the badge is earned", async () => {
    const { family } = await createFamilyFixture(db);
    const kid = await createChildFixture(db, family.id);
    const def = await db.achievementDefinition.upsert({
      where: { key: "test.gallery" },
      create: {
        key: "test.gallery",
        title: "Test Badge",
        description: "Complete exactly 17 chores",
        hint: "Practice makes perfect.",
        criteria: { type: "APPROVED_ACTIVITY_COUNT", count: 17 },
      },
      update: {},
    });

    const locked = (await listAchievementGallery(db, kid.ctx)).find(
      (a) => a.key === "test.gallery",
    );
    expect(locked).toMatchObject({
      earned: false,
      description: null,
      hint: "Practice makes perfect.",
    });
    expect(JSON.stringify(locked)).not.toContain("17");

    await db.earnedAchievement.create({
      data: { familyId: family.id, childId: kid.child.id, achievementId: def.id },
    });
    const earned = (await listAchievementGallery(db, kid.ctx)).find(
      (a) => a.key === "test.gallery",
    );
    expect(earned).toMatchObject({
      earned: true,
      description: "Complete exactly 17 chores",
      hint: null,
    });

    // A sibling in the same family does not inherit it.
    const sibling = await createChildFixture(db, family.id, "Sib");
    const theirs = (await listAchievementGallery(db, sibling.ctx)).find(
      (a) => a.key === "test.gallery",
    );
    expect(theirs?.earned).toBe(false);
    await db.achievementDefinition.delete({ where: { key: "test.gallery" } });
  });

  it("falls back to a generic hint", async () => {
    const { family } = await createFamilyFixture(db);
    const kid = await createChildFixture(db, family.id);
    await db.achievementDefinition.create({
      data: {
        key: "test.nohint",
        title: "No hint",
        description: "secret condition",
        criteria: { type: "ROUTINE_COUNT", count: 3 },
      },
    });
    const item = (await listAchievementGallery(db, kid.ctx)).find((a) => a.key === "test.nohint");
    expect(item?.hint).toMatch(/Keep going/);
    await db.achievementDefinition.delete({ where: { key: "test.nohint" } });
  });
});
