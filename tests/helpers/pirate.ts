import { reviewOccurrence } from "@/server/services/approval.service";
import {
  claimChapterReward,
  startAdventure,
  submitPuzzleAnswer,
} from "@/server/services/adventure.service";
import { purchaseItem } from "@/server/services/inventory.service";

import { testDb } from "./db";
import {
  createChildFixture,
  createFamilyFixture,
  createOccurrenceFixture,
  createTaskFixture,
} from "./fixtures";

/**
 * Shared set-up for pirate adventure integration tests: a household with children enrolled in the pirate
 * adventure and a helper that approves chores for them, plus helpers that play chapters through.
 */
const db = testDb();

export type Category = "CHORE" | "HYGIENE" | "SCHOOL" | "PET_CARE" | "HELPING" | "OTHER";
export type Household = Awaited<ReturnType<typeof household>>;

export const COVE_ANSWER = {
  pairs: { hull: "hammer", mast: "saw", sail: "needle", wheel: "wrench", anchor: "oil" },
};

export async function household(names: string[] = ["Ada"]) {
  const { family, ctx } = await createFamilyFixture(db);
  const tasks: Record<string, Awaited<ReturnType<typeof createTaskFixture>>> = {};
  for (const category of ["CHORE", "HYGIENE", "SCHOOL", "PET_CARE", "HELPING"] as Category[]) {
    tasks[category] = await createTaskFixture(db, family.id, {
      points: 5,
      category,
      title: category,
    });
  }
  const kids = [];
  for (const name of names) {
    const { child, ctx: childCtx } = await createChildFixture(db, family.id, name);
    await startAdventure(db, { familyId: family.id, childId: child.id, adventureKey: "pirate" });
    kids.push({ child, ctx: childCtx });
  }
  let day = 1;
  const approve = async (childId: string, category: Category = "CHORE", times = 1) => {
    for (let i = 0; i < times; i += 1) {
      day += 1;
      const { occurrence } = await createOccurrenceFixture(db, {
        familyId: family.id,
        childId,
        taskId: tasks[category]!.id,
        localDate: `2026-${String(10 + Math.floor(day / 28)).padStart(2, "0")}-${String((day % 28) + 1).padStart(2, "0")}`,
      });
      await reviewOccurrence(db, ctx, {
        familyId: family.id,
        occurrenceId: occurrence.id,
        decision: "APPROVED",
      });
    }
  };
  return { family, ctx, kids, approve };
}

export const chapterId = async (key: string) =>
  (await db.adventureChapter.findFirstOrThrow({ where: { key } })).id;
export const puzzleId = async (key: string) =>
  (await db.puzzleDefinition.findFirstOrThrow({ where: { key } })).id;

type Kid = Household["kids"][number];

export async function buyShip(h: Household, kid: Kid, itemKey: string) {
  return purchaseItem(db, {
    familyId: h.family.id,
    childId: kid.child.id,
    itemKey,
    idempotencyKey: `buy-${itemKey}-${kid.child.id}`,
  });
}

/** Home Port and Parrot Island played through, every reward claimed, nothing else bought. */
export async function finishParrotIsland(h: Household, kid: Kid = h.kids[0]!) {
  await h.approve(kid.child.id, "CHORE", 3);
  await claimChapterReward(db, kid.ctx, await chapterId("home-port"));
  await h.approve(kid.child.id, "CHORE", 4);
  await submitPuzzleAnswer(db, kid.ctx, await puzzleId("compass-puzzle"), {
    sequence: ["N", "E", "S", "W"],
  });
  await claimChapterReward(db, kid.ctx, await chapterId("parrot-island"));
}

/** Shipwreck Cove played through (explorer bought on the way) and its reward claimed. Nothing else bought. */
export async function finishShipwreckCove(h: Household, kid: Kid = h.kids[0]!) {
  await finishParrotIsland(h, kid);
  await buyShip(h, kid, "ship-explorer");
  await h.approve(kid.child.id, "CHORE", 4);
  await h.approve(kid.child.id, "CHORE", 3);
  await submitPuzzleAnswer(db, kid.ctx, await puzzleId("repair-puzzle"), COVE_ANSWER);
  await claimChapterReward(db, kid.ctx, await chapterId("shipwreck-cove"));
}
