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
 * Shipwreck Cove (Phase 5, slice 1): ship gate, salvage, gated Wreck, pair-match repair and the chapter
 * reward. Isolated household built directly in the database and removed afterwards, so the demo family and
 * the rate-limited sign-in endpoints are untouched.
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

test.describe("phase 5: Shipwreck Cove", () => {
  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("ship gate, salvage, gated wreck, repair puzzle and chapter reward", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "mutating flow runs once, on desktop");
    test.setTimeout(240_000);

    const { user, family, ctx } = await createFamilyFixture(db);
    const { child, ctx: childCtx } = await createChildFixture(db, family.id, "Mate", PIN);
    const chore = await createTaskFixture(db, family.id, { points: 5, category: "CHORE" });
    const hygiene = await createTaskFixture(db, family.id, { points: 5, category: "HYGIENE" });
    await startAdventure(db, { familyId: family.id, childId: child.id, adventureKey: "pirate" });
    let day = 1;
    const approve = async (task: { id: string }, times: number) => {
      for (let i = 0; i < times; i += 1) {
        day += 1;
        const { occurrence } = await createOccurrenceFixture(db, {
          familyId: family.id,
          childId: child.id,
          taskId: task.id,
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

    try {
      // Home Port and Parrot Island, finished through the services (covered by earlier specs).
      await approve(chore, 3);
      await claimChapterReward(db, childCtx, await chapterId("home-port"));
      await approve(chore, 4);
      const compass = await db.puzzleDefinition.findFirstOrThrow({
        where: { key: "compass-puzzle" },
      });
      await submitPuzzleAnswer(db, childCtx, compass.id, { sequence: ["N", "E", "S", "W"] });
      await claimChapterReward(db, childCtx, await chapterId("parrot-island"));

      await signInChildDirect(page, family.childLoginCode, "Mate");

      // --- Locked until the ship is bought, and the map says why -----------------------------------
      await page.goto("/child/adventure");
      const coveRow = page
        .getByTestId("chapter-list")
        .locator("li", { hasText: /^3\. Shipwreck Cove/ });
      await expect(coveRow).toContainText("Need Explorer Ship");
      await page.goto("/child/adventure/shipwreck-cove");
      await expect(page.getByText("still hidden in the mist")).toBeVisible();

      await purchaseItem(db, {
        familyId: family.id,
        childId: child.id,
        itemKey: "ship-explorer",
        idempotencyKey: "e2e-explorer-purchase",
      });
      await page.goto("/child/adventure");
      await expect(coveRow).not.toContainText("Need");

      // --- The cove: three places with pages, the wreck closed -------------------------------------
      await page.goto("/child/adventure/shipwreck-cove");
      await expect(
        page.getByRole("heading", { name: "Shipwreck Cove", exact: true }),
      ).toBeVisible();
      for (const name of [/Salvage Yard/, /Tide Pools/, /The Wreck/]) {
        const link = page.getByRole("link", { name });
        await expect(link).toBeVisible();
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await page.getByRole("link", { name: /The Wreck/ }).click();
      await expect(page.getByRole("heading", { name: "The Wreck", exact: true })).toBeVisible();
      await expect(page.getByTestId("puzzle-gated")).toContainText("4 × Salvage Plank");
      await expect(page.getByTestId("puzzle")).toHaveCount(0);

      // --- Salvage yard shows this child's progress ------------------------------------------------
      await approve(chore, 2);
      await page.goto("/child/adventure/shipwreck-cove/salvage-yard");
      await expect(page.getByRole("heading", { name: "Salvage Yard", exact: true })).toBeVisible();
      await expect(page.getByTestId("collection-slots").first()).toHaveAttribute(
        "data-collected",
        "2",
      );
      await page.goto("/child/adventure/shipwreck-cove/the-wreck");
      await expect(page.getByTestId("puzzle-gated")).toContainText("2 more");

      // --- Four planks open the wreck ---------------------------------------------------------------
      await approve(chore, 2);
      await page.reload();
      const puzzle = page.getByTestId("puzzle");
      await expect(puzzle).toHaveAttribute("data-puzzle-type", "pair-match");
      await expect(page.getByTestId("puzzle-gated")).toHaveCount(0);
      // The answer never reaches the browser: no pairs in the page, and tools are not in solution order.
      const html = await page.content();
      expect(html.match(/[\s\S]{0,80}\bpairs\b[\s\S]{0,80}/)?.[0]).toBeUndefined();
      expect(html).not.toMatch(/hull["\\:\s]+hammer/);

      for (const testId of ["part-hull", "tool-hammer", "puzzle-check"]) {
        expect((await page.getByTestId(testId).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      const check = page.getByTestId("puzzle-check");
      await expect(check).toBeDisabled();

      // Wrong on purpose: hull and mast swapped. Picks advance to the next part automatically.
      for (const tool of ["saw", "hammer", "needle", "wrench", "oil"]) {
        await page.getByTestId(`tool-${tool}`).click();
      }
      await expect(page.getByTestId("part-hull-tool")).toContainText("Saw");
      await expect(page.getByTestId("puzzle-announce")).toContainText("5 of 5 matched");
      await check.click();
      const feedback = page.getByTestId("puzzle-feedback");
      await expect(feedback).toHaveAttribute("data-kind", "wrong");
      const text = (await feedback.textContent()) ?? "";
      expect(text).toContain("Not quite");
      expect(text).not.toMatch(/\d/);
      expect(text).not.toMatch(/hull|mast|sail|wheel|anchor|hammer|saw|needle|wrench|oil/i);
      expect(await db.puzzleAttempt.count({ where: { childId: child.id, status: "FAILED" } })).toBe(
        1,
      );

      // Fix it: choose a part, then its tool (a tool moves off the part that had it).
      await page.getByTestId("part-hull").click();
      await page.getByTestId("tool-hammer").click();
      await expect(page.getByTestId("part-hull-tool")).toContainText("Hammer");
      await expect(page.getByTestId("part-mast-tool")).toContainText("Choose a tool");
      await page.getByTestId("tool-saw").click(); // selection advanced to the unmatched part
      await expect(page.getByTestId("part-mast-tool")).toContainText("Saw");
      await page.getByRole("button", { name: "Clear" }).click();
      await expect(page.getByTestId("part-hull-tool")).toContainText("Choose a tool");
      for (const tool of ["hammer", "saw", "needle", "wrench", "oil"]) {
        await page.getByTestId(`tool-${tool}`).click();
      }
      await check.click();
      await expect(page.getByTestId("puzzle-solved")).toBeVisible();
      await expect(feedback).toHaveAttribute("data-kind", "solved");
      expect(
        await db.puzzleAttempt.count({ where: { childId: child.id, status: "COMPLETED" } }),
      ).toBe(2); // compass + repair

      // The salvage was held, not spent.
      const planks = await db.childInventoryItem.findFirstOrThrow({
        where: { childId: child.id, item: { key: "salvage-plank" } },
      });
      expect(planks.quantity).toBe(4);

      // --- Rope finishes the quest; the chapter completes and its reward is claimed -----------------
      await page.reload();
      await expect(page.getByTestId("puzzle-solved")).toBeVisible();
      await approve(hygiene, 3);
      await page.goto("/child/adventure/shipwreck-cove");
      await expect(page.getByText("Chapter complete!")).toBeVisible();
      await page.getByRole("button", { name: "Claim chapter reward" }).click();
      await expect(page.getByText("Chapter reward claimed")).toBeVisible();

      // Skull Reef needs the voyager ship as well (ADR 0020): finishing the cove alone leaves it locked.
      await page.goto("/child/adventure");
      const reefRow = page
        .getByTestId("chapter-list")
        .locator("li", { hasText: /^4\. Skull Reef/ });
      await expect(reefRow).toContainText("Need Voyager Ship");
      await expect(reefRow).not.toContainText("Finish");
      const skull = await db.childChapterProgress.findFirstOrThrow({
        where: { childId: child.id, chapter: { key: "skull-reef" } },
      });
      expect(skull.status).toBe("LOCKED");
    } finally {
      await db.family.delete({ where: { id: family.id } }).catch(() => undefined);
      await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("anonymous visitors are sent to sign-in from the wreck", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/child/adventure/shipwreck-cove/the-wreck");
    await expect(page).toHaveURL(/sign-in/);
    await ctx.close();
  });
});
