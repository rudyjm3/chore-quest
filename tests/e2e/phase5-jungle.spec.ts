import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

import { createPrismaClient } from "@/lib/db/prisma";
import {
  claimChapterReward,
  startAdventure,
  submitPuzzleAnswer,
} from "@/server/services/adventure.service";
import { reviewOccurrence } from "@/server/services/approval.service";
import { purchaseItem } from "@/server/services/inventory.service";

import {
  createChildFixture,
  createFamilyFixture,
  createOccurrenceFixture,
  createTaskFixture,
} from "../helpers/fixtures";

/**
 * Whispering Jungle (Phase 5, slice 3): artifacts found by chores, the ruins that need all three, the clue-order
 * puzzle, the two-step temple and the chapter reward. Isolated household built directly in the database and removed
 * afterwards, so the demo family and the rate-limited sign-in endpoints are untouched.
 */
const db = createPrismaClient(process.env.DATABASE_URL ?? "");
const PIN = "2468";

async function signInChildDirect(page: Page, familyCode: string, name: string) {
  await page.goto("/child/sign-in");
  await page.getByLabel("Family code").fill(familyCode);
  await page.getByRole("button", { name: "Find my crew" }).click();
  await page.getByLabel(name).check();
  await page.getByLabel("Secret PIN").fill(PIN);
  await page.getByRole("button", { name: "Set sail!" }).click();
  await page.waitForURL("**/child");
}

async function sail(page: Page, moves: string[]) {
  for (const move of moves) await page.getByTestId(`route-${move}`).click();
}

const MAZE = [
  "up",
  "up",
  "right",
  "up",
  "right",
  "right",
  "right",
  "right",
  "right",
  "up",
  "up",
  "up",
];

test.describe("phase 5: Whispering Jungle", () => {
  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("artifacts, gated ruins, clue puzzle, temple in order and the chapter reward", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "mutating flow runs once, on desktop");
    test.setTimeout(300_000);

    const { user, family, ctx } = await createFamilyFixture(db);
    const { child, ctx: childCtx } = await createChildFixture(db, family.id, "Mate", PIN);
    const chore = await createTaskFixture(db, family.id, { points: 5, category: "CHORE" });
    await startAdventure(db, { familyId: family.id, childId: child.id, adventureKey: "pirate" });
    let day = 1;
    const approve = async (times: number) => {
      for (let i = 0; i < times; i += 1) {
        day += 1;
        const { occurrence } = await createOccurrenceFixture(db, {
          familyId: family.id,
          childId: child.id,
          taskId: chore.id,
          localDate: `2026-11-${String(day).padStart(2, "0")}`,
        });
        await reviewOccurrence(db, ctx, {
          familyId: family.id,
          occurrenceId: occurrence.id,
          decision: "APPROVED",
        });
      }
    };
    const chapterId = async (key: string) =>
      (await db.adventureChapter.findFirstOrThrow({ where: { key } })).id;
    const puzzleId = async (key: string) =>
      (await db.puzzleDefinition.findFirstOrThrow({ where: { key } })).id;
    const solve = async (key: string, answer: unknown) =>
      submitPuzzleAnswer(db, childCtx, await puzzleId(key), answer);
    const buy = (itemKey: string) =>
      purchaseItem(db, {
        familyId: family.id,
        childId: child.id,
        itemKey,
        idempotencyKey: `e2e-jungle-${itemKey}`,
      });

    try {
      // Earlier chapters through the services (covered by earlier specs); only the two ships are bought.
      await approve(3);
      await claimChapterReward(db, childCtx, await chapterId("home-port"));
      await approve(4);
      await solve("compass-puzzle", { sequence: ["N", "E", "S", "W"] });
      await claimChapterReward(db, childCtx, await chapterId("parrot-island"));
      await buy("ship-explorer");
      await approve(7);
      await solve("repair-puzzle", {
        pairs: { hull: "hammer", mast: "saw", sail: "needle", wheel: "wrench", anchor: "oil" },
      });
      await claimChapterReward(db, childCtx, await chapterId("shipwreck-cove"));
      await buy("ship-voyager");
      await approve(5);
      await solve("reef-chart-puzzle", {
        moves: ["right", "up", "up", "right", "up", "up", "right", "right"],
      });
      await solve("kraken-tentacles", { sequence: ["Coil", "Sweep", "Slam", "Sweep", "Snap"] });
      await solve("kraken-weak-points", {
        pairs: { tentacle: "net", beak: "shield", eye: "glass", ink: "lantern", grip: "hook" },
      });
      await solve("kraken-escape", {
        moves: ["right", "up", "up", "up", "right", "right", "right", "right", "up", "up"],
      });
      await claimChapterReward(db, childCtx, await chapterId("skull-reef"));

      await signInChildDirect(page, family.childLoginCode, "Mate");

      // --- Open with no ship needed ----------------------------------------------------------------
      await page.goto("/child/adventure");
      const jungleRow = page
        .getByTestId("chapter-list")
        .locator("li", { hasText: /^5\. Whispering Jungle/ });
      await expect(jungleRow).toBeVisible();
      await expect(jungleRow).not.toContainText("Need");
      await expect(jungleRow).not.toContainText("Finish");

      await page.goto("/child/adventure/whispering-jungle");
      await expect(
        page.getByRole("heading", { name: "Whispering Jungle", exact: true }),
      ).toBeVisible();
      for (const name of [/Ancient Ruins/, /Glyph Wall/, /Vine Maze/, /Temple Watch/]) {
        const link = page.getByRole("link", { name });
        await expect(link).toBeVisible();
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }

      // --- The ruins need all three artifacts; the temple waits for the clues --------------------------
      await page.goto("/child/adventure/whispering-jungle/ancient-ruins");
      const gated = page.getByTestId("puzzle-gated");
      await expect(gated).toContainText("Jade Idol");
      await expect(gated).toContainText("Stone Mask");
      await expect(gated).toContainText("Sun Key");
      await expect(page.getByTestId("puzzle")).toHaveCount(0);
      await page.goto("/child/adventure/whispering-jungle/glyph-wall");
      await expect(page.getByTestId("puzzle-waiting")).toContainText("Follow the Clues");

      // Two artifacts held: only the key is still asked for.
      await approve(4);
      await page.goto("/child/adventure/whispering-jungle/ancient-ruins");
      await expect(page.getByTestId("puzzle-gated")).toContainText("Sun Key");
      await expect(page.getByTestId("puzzle-gated")).not.toContainText("Jade Idol");

      // --- Three held: the clue puzzle opens -----------------------------------------------------------
      await approve(1);
      await page.goto("/child/adventure/whispering-jungle/ancient-ruins");
      const puzzle = page.getByTestId("puzzle");
      await expect(puzzle).toHaveAttribute("data-puzzle-type", "clue-order");
      await expect(page.getByTestId("puzzle-gated")).toHaveCount(0);
      await expect(page.getByTestId("clues").locator("li")).toHaveCount(6);
      expect(await page.content()).not.toMatch(/"(solution|order)"/);
      for (const testId of ["clue-slot-1", "clue-item-idol", "puzzle-check"]) {
        expect((await page.getByTestId(testId).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      const check = page.getByTestId("puzzle-check");
      await expect(check).toBeDisabled();

      // Wrong on purpose: the things in the order they are listed.
      for (const key of ["bowl", "idol", "key", "mask", "statue"]) {
        await page.getByTestId(`clue-item-${key}`).click();
      }
      await expect(page.getByTestId("clue-slot-1")).toContainText("Water bowl");
      await check.click();
      const feedback = page.getByTestId("puzzle-feedback");
      await expect(feedback).toHaveAttribute("data-kind", "wrong");
      const text = (await feedback.textContent()) ?? "";
      expect(text).toContain("Not quite");
      expect(text).not.toMatch(/\d|bowl|idol|statue|mask|key/i);
      expect(await db.puzzleAttempt.count({ where: { childId: child.id, status: "FAILED" } })).toBe(
        1,
      );

      // Take one back, then do it properly.
      await page.getByTestId("clue-slot-1").click();
      await expect(page.getByTestId("clue-slot-1")).toContainText("Empty");
      await page.getByRole("button", { name: "Clear" }).click();
      for (const key of ["statue", "idol", "bowl", "mask", "key"]) {
        await page.getByTestId(`clue-item-${key}`).click();
      }
      await check.click();
      await expect(page.getByTestId("puzzle-solved")).toBeVisible();

      // The artifacts were held, not spent.
      const held = await db.childInventoryItem.findMany({
        where: { childId: child.id, item: { key: { in: ["jade-idol", "stone-mask", "sun-key"] } } },
      });
      expect(held.map((r) => r.quantity)).toEqual([1, 1, 1]);

      // --- The last search finishes the first quest; the temple opens ---------------------------------
      await approve(1);
      await page.goto("/child/adventure/whispering-jungle/glyph-wall");
      await expect(page.getByTestId("puzzle")).toHaveAttribute("data-puzzle-type", "pair-match");
      await page.getByTestId("part-sun").click();
      for (const tool of ["day", "night", "danger", "water", "warmth"]) {
        await page.getByTestId(`tool-${tool}`).click();
      }
      await page.getByTestId("puzzle-check").click();
      await expect(page.getByTestId("puzzle-solved")).toBeVisible();

      await page.goto("/child/adventure/whispering-jungle/vine-maze");
      await expect(page.getByTestId("puzzle")).toHaveAttribute("data-puzzle-type", "route-plan");
      await sail(page, MAZE);
      await page.getByTestId("puzzle-check").click();
      await expect(page.getByTestId("puzzle-solved")).toBeVisible();

      // --- Chapter reward, and Treasure Island now waits for the legendary ship --------------------------------
      await page.goto("/child/adventure/whispering-jungle");
      await expect(page.getByText("Chapter complete!")).toBeVisible();
      await page.getByRole("button", { name: "Claim chapter reward" }).click();
      await expect(page.getByText("Chapter reward claimed")).toBeVisible();
      const fragments = await db.childInventoryItem.findFirstOrThrow({
        where: { childId: child.id, item: { key: "map-fragment" } },
      });
      expect(fragments.quantity).toBe(5);

      await page.goto("/child/adventure");
      const islandRow = page
        .getByTestId("chapter-list")
        .locator("li", { hasText: /^6\. Treasure Island/ });
      // The fifth fragment is in the hold; only the legendary ship (ADR 0022) is still missing.
      await expect(islandRow).toContainText("Need Legendary Ship");
      await expect(islandRow).not.toContainText("map");
      const island = await db.childChapterProgress.findFirstOrThrow({
        where: { childId: child.id, chapter: { key: "treasure-island" } },
      });
      expect(island.status).toBe("LOCKED");
    } finally {
      await db.family.delete({ where: { id: family.id } }).catch(() => undefined);
      await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("anonymous visitors are sent to sign-in from the ruins", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/child/adventure/whispering-jungle/ancient-ruins");
    await expect(page).toHaveURL(/sign-in/);
    await ctx.close();
  });
});
