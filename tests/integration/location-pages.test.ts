import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { buildLocationView } from "@/features/adventures/location-view";
import {
  claimChapterReward,
  getAdventureState,
  getPuzzleForChild,
  startAdventure,
  submitPuzzleAnswer,
} from "@/server/services/adventure.service";
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
  let day = 1;
  const approve = async (childId: string) => {
    day += 1;
    const { occurrence } = await createOccurrenceFixture(db, {
      familyId: family.id,
      childId,
      taskId: task.id,
      localDate: `2026-11-${String(day).padStart(2, "0")}`,
    });
    await reviewOccurrence(db, ctx, {
      familyId: family.id,
      occurrenceId: occurrence.id,
      decision: "APPROVED",
    });
  };
  return { family, a, b, approve };
}

const params = { adventureKey: "pirate", chapterKey: "parrot-island", puzzleKey: "compass-puzzle" };

describe("Parrot Island locations (feather grove, compass shrine)", () => {
  it("the grove shows this child's feather count, never a sibling's", async () => {
    const { a, b, approve } = await twoChildren();
    for (let i = 0; i < 3; i += 1) await approve(a.child.id);
    await claimChapterReward(
      db,
      a.ctx,
      (await db.adventureChapter.findFirstOrThrow({ where: { key: "home-port" } })).id,
    );
    for (let i = 0; i < 2; i += 1) await approve(a.child.id);

    const stateA = await getAdventureState(db, a.ctx, "pirate");
    const grove = buildLocationView(
      stateA.chapters.find((c) => c.key === "parrot-island")!,
      "feather-grove",
    );
    expect(grove?.kind === "quest-board" && grove.collections[0]).toMatchObject({
      current: 2,
      target: 4,
    });

    // Bo has done nothing: Parrot Island is locked and shows no progress.
    const stateB = await getAdventureState(db, b.ctx, "pirate");
    const chapterB = stateB.chapters.find((c) => c.key === "parrot-island")!;
    expect(chapterB.status).toBe("LOCKED");
    expect(chapterB.quests.every((q) => q.objectives.every((o) => o.currentCount === 0))).toBe(
      true,
    );
  });

  it("the shrine is not available until the feathers are collected, then solved after the puzzle", async () => {
    const { a, approve } = await twoChildren();
    for (let i = 0; i < 3; i += 1) await approve(a.child.id);
    await claimChapterReward(
      db,
      a.ctx,
      (await db.adventureChapter.findFirstOrThrow({ where: { key: "home-port" } })).id,
    );
    const shrine = async () => {
      const state = await getAdventureState(db, a.ctx, "pirate");
      return buildLocationView(
        state.chapters.find((c) => c.key === "parrot-island")!,
        "compass-shrine",
      );
    };
    expect(await shrine()).toMatchObject({
      kind: "puzzle",
      available: false,
      waitingFor: "Collect 4 compass feathers",
      solved: false,
    });
    for (let i = 0; i < 4; i += 1) await approve(a.child.id);
    expect(await shrine()).toMatchObject({ available: true, solved: false });

    const puzzle = await getPuzzleForChild(db, a.ctx, params);
    expect(puzzle.solved).toBe(false);
    const wrong = await submitPuzzleAnswer(db, a.ctx, puzzle.id, { sequence: ["E", "N"] });
    expect(wrong.correct).toBe(false);
    expect(await shrine()).toMatchObject({ solved: false });
    await submitPuzzleAnswer(db, a.ctx, puzzle.id, { sequence: ["N", "E", "S", "W"] });
    expect(await shrine()).toMatchObject({ solved: true });
    expect((await getPuzzleForChild(db, a.ctx, params)).solved).toBe(true);
  });
});

describe("getPuzzleForChild", () => {
  it("never returns the answer, only the verifier's client view", async () => {
    const { a, approve } = await twoChildren();
    for (let i = 0; i < 3; i += 1) await approve(a.child.id);
    const puzzle = await getPuzzleForChild(db, a.ctx, params);
    expect(puzzle.view).toEqual({
      symbols: ["N", "E", "S", "W"],
      hint: expect.any(String),
    });
    expect(JSON.stringify(puzzle)).not.toContain('"sequence":'); // the type name "sequence-match" is fine
    expect(puzzle.view).not.toHaveProperty("sequence");
  });

  it("refuses a chapter the child has not unlocked, and unknown puzzles", async () => {
    const { b } = await twoChildren();
    await expect(getPuzzleForChild(db, b.ctx, params)).rejects.toThrow(/not available/);
    await expect(getPuzzleForChild(db, b.ctx, { ...params, puzzleKey: "nope" })).rejects.toThrow();
    await expect(
      getPuzzleForChild(db, b.ctx, { ...params, adventureKey: "other-theme" }),
    ).rejects.toThrow();
  });

  it("solved is per child: a sibling's solved puzzle does not show as solved", async () => {
    const { a, b, approve } = await twoChildren();
    for (const c of [a, b]) {
      for (let i = 0; i < 3; i += 1) await approve(c.child.id);
      await claimChapterReward(
        db,
        c.ctx,
        (await db.adventureChapter.findFirstOrThrow({ where: { key: "home-port" } })).id,
      );
    }
    for (let i = 0; i < 4; i += 1) await approve(a.child.id);
    const puzzle = await getPuzzleForChild(db, a.ctx, params);
    await submitPuzzleAnswer(db, a.ctx, puzzle.id, { sequence: ["N", "E", "S", "W"] });
    expect((await getPuzzleForChild(db, a.ctx, params)).solved).toBe(true);
    expect((await getPuzzleForChild(db, b.ctx, params)).solved).toBe(false);
  });
});
