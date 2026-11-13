import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { buildQuestBoard } from "@/features/adventures/quest-board";
import { getAdventureState, startAdventure } from "@/server/services/adventure.service";
import { reviewOccurrence } from "@/server/services/approval.service";

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

async function twoChildren() {
  const { family, ctx } = await createFamilyFixture(db);
  const a = await createChildFixture(db, family.id, "Ada");
  const b = await createChildFixture(db, family.id, "Bo");
  for (const c of [a, b]) {
    await startAdventure(db, { familyId: family.id, childId: c.child.id, adventureKey: "pirate" });
  }
  const task = await createTaskFixture(db, family.id, { points: 5 });
  return { family, ctx, a, b, task };
}

describe("quest board data (getAdventureState + buildQuestBoard)", () => {
  it("lists the active Home Port quests with objectives and a reward preview", async () => {
    const { a } = await twoChildren();
    const state = await getAdventureState(db, a.ctx, "pirate");
    const board = buildQuestBoard(state.chapters);
    expect(board.map((s) => s.chapterKey)).toEqual(["home-port"]);
    const quests = board[0]!.quests;
    expect(quests.length).toBeGreaterThan(0);
    expect(quests.every((q) => q.status === "ACTIVE" && q.objectives.length > 0)).toBe(true);
    expect(
      quests.some((q) => q.rewards.coins > 0 || q.rewards.xp > 0 || q.rewards.items.length),
    ).toBe(true);
  });

  it("shows only this child's progress, never a sibling's", async () => {
    const { family, ctx, a, b, task } = await twoChildren();
    const { occurrence } = await createOccurrenceFixture(db, {
      familyId: family.id,
      childId: a.child.id,
      taskId: task.id,
      localDate: "2026-11-02",
    });
    await reviewOccurrence(db, ctx, {
      familyId: family.id,
      occurrenceId: occurrence.id,
      decision: "APPROVED",
    });

    const counts = async (c: typeof a) =>
      buildQuestBoard((await getAdventureState(db, c.ctx, "pirate")).chapters)
        .flatMap((s) => s.quests.flatMap((q) => q.objectives))
        .reduce((sum, o) => sum + o.currentCount, 0);
    expect(await counts(a)).toBeGreaterThan(0);
    expect(await counts(b)).toBe(0);
  });

  it("a child who has not started sees an empty board input", async () => {
    const { family } = await createFamilyFixture(db);
    const { ctx } = await createChildFixture(db, family.id, "New");
    const state = await getAdventureState(db, ctx, "pirate");
    expect(state.started).toBe(false);
    expect(buildQuestBoard(state.chapters)).toEqual([]);
  });
});
