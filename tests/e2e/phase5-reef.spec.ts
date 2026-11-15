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
 * Skull Reef (Phase 5, slice 2): voyager gate, chart pieces, the route-plan puzzle and the three Kraken stages.
 * Isolated household built directly in the database and removed afterwards, so the demo family and the
 * rate-limited sign-in endpoints are untouched.
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

/** Press the arrow buttons of a route-plan board, in order. */
async function sail(page: Page, moves: string[]) {
  for (const move of moves) await page.getByTestId(`route-${move}`).click();
}

const CHART_ROUTE = ["right", "up", "up", "right", "up", "up", "right", "right"];
const ESCAPE_ROUTE = ["right", "up", "up", "up", "right", "right", "right", "right", "up", "up"];

test.describe("phase 5: Skull Reef", () => {
  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("voyager gate, chart pieces, route puzzle, the Kraken in order and the chapter reward", async ({
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

    try {
      // Earlier chapters, finished through the services (covered by earlier specs). Nothing is bought but the explorer.
      await approve(3);
      await claimChapterReward(db, childCtx, await chapterId("home-port"));
      await approve(4);
      await submitPuzzleAnswer(db, childCtx, await puzzleId("compass-puzzle"), {
        sequence: ["N", "E", "S", "W"],
      });
      await claimChapterReward(db, childCtx, await chapterId("parrot-island"));
      await purchaseItem(db, {
        familyId: family.id,
        childId: child.id,
        itemKey: "ship-explorer",
        idempotencyKey: "e2e-reef-explorer",
      });
      await approve(7);
      await submitPuzzleAnswer(db, childCtx, await puzzleId("repair-puzzle"), {
        pairs: { hull: "hammer", mast: "saw", sail: "needle", wheel: "wrench", anchor: "oil" },
      });
      await claimChapterReward(db, childCtx, await chapterId("shipwreck-cove"));
      const coins = await db.rewardWallet.findFirstOrThrow({
        where: { childId: child.id, currency: "COINS" },
      });
      expect(coins.balance).toBe(415); // the economy check: the voyager (400) is affordable

      await signInChildDirect(page, family.childLoginCode, "Mate");

      // --- Locked until the voyager is bought, and the map says why -------------------------------
      await page.goto("/child/adventure");
      const reefRow = page
        .getByTestId("chapter-list")
        .locator("li", { hasText: /^4\. Skull Reef/ });
      await expect(reefRow).toContainText("Need Voyager Ship");
      await expect(reefRow).not.toContainText("Finish");
      await page.goto("/child/adventure/skull-reef");
      await expect(page.getByText("still hidden in the mist")).toBeVisible();

      // --- Buying it in the shop opens the chapter ------------------------------------------------
      await page.goto("/child/supplies");
      await page.getByTestId("buy-ship-voyager").click();
      await expect(page.locator("[data-sonner-toast]").first()).toContainText(
        "You bought Voyager Ship",
      );
      await page.goto("/child/adventure");
      await expect(reefRow).not.toContainText("Need");

      // --- The reef: places with pages, the chart table closed ------------------------------------
      await page.goto("/child/adventure/skull-reef");
      await expect(page.getByRole("heading", { name: "Skull Reef", exact: true })).toBeVisible();
      for (const name of [
        /Reef Chart Table/,
        /Tentacle Rocks/,
        /Kraken's Lair/,
        /Whirlpool Gate/,
        /Kraken Watch/,
      ]) {
        const link = page.getByRole("link", { name });
        await expect(link).toBeVisible();
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await page.goto("/child/adventure/skull-reef/chart-table");
      await expect(page.getByTestId("puzzle-gated")).toContainText("5 × Reef Chart Piece");
      await expect(page.getByTestId("puzzle")).toHaveCount(0);

      // The Kraken waits for the chart: its stages say so and show no puzzle.
      await page.goto("/child/adventure/skull-reef/tentacle-rocks");
      await expect(page.getByTestId("puzzle-waiting")).toContainText("Navigate the Reef");
      await expect(page.getByTestId("puzzle")).toHaveCount(0);

      // --- Five chart pieces open the table ------------------------------------------------------
      await approve(5);
      await page.goto("/child/adventure/skull-reef/chart-table");
      const puzzle = page.getByTestId("puzzle");
      await expect(puzzle).toHaveAttribute("data-puzzle-type", "route-plan");
      await expect(page.getByTestId("puzzle-gated")).toHaveCount(0);
      // The browser gets the board but no route, and the stored layout is not a path.
      const html = await page.content();
      expect(html).not.toMatch(/"(moves|path|solution)"/);

      for (const testId of ["route-up", "route-down", "route-left", "route-right", "route-undo"]) {
        expect((await page.getByTestId(testId).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      const check = page.getByTestId("puzzle-check");
      await expect(check).toBeDisabled();
      await expect(page.getByTestId("route-cell-0-4")).toHaveAttribute("data-kind", "ship");
      await expect(page.getByTestId("route-cell-2-4")).toHaveAttribute("data-kind", "reef");

      // Impossible steps are refused with a message and change nothing; undo and clear work.
      await page.getByTestId("route-left").click();
      await expect(page.getByTestId("puzzle-announce")).toContainText("edge of the chart");
      await sail(page, ["right", "right"]); // (2,4) is a reef
      await expect(page.getByTestId("puzzle-announce")).toContainText("rock is in the way");
      await expect(page.getByTestId("route-count")).toHaveText("1 move");
      await page.getByTestId("route-undo").click();
      await expect(page.getByTestId("route-count")).toHaveText("0 moves");
      await sail(page, ["up", "up"]); // (0,2) is a reef: only one step is possible
      await expect(page.getByTestId("route-count")).toHaveText("1 move");
      await page.getByTestId("route-clear").click();
      await expect(page.getByTestId("route-count")).toHaveText("0 moves");

      // Short of the goal the button stays off; the full route turns it on.
      await sail(page, CHART_ROUTE.slice(0, 5));
      await expect(check).toBeDisabled();
      await sail(page, CHART_ROUTE.slice(5));
      await expect(check).toBeEnabled();
      expect(await db.puzzleAttempt.count({ where: { childId: child.id, status: "FAILED" } })).toBe(
        0,
      );
      await check.click();
      await expect(page.getByTestId("puzzle-solved")).toBeVisible();
      await expect(page.getByTestId("puzzle-feedback")).toHaveAttribute("data-kind", "solved");
      // The pieces were held, not spent.
      const pieces = await db.childInventoryItem.findFirstOrThrow({
        where: { childId: child.id, item: { key: "chart-piece" } },
      });
      expect(pieces.quantity).toBe(5);

      // --- Kraken, stage 1: the tentacle pattern (sequence-match) -----------------------------------
      await page.goto("/child/adventure/skull-reef/krakens-lair");
      await expect(page.getByTestId("puzzle-waiting")).toContainText("tentacle pattern");
      await page.goto("/child/adventure/skull-reef/tentacle-rocks");
      const stage1 = page.getByTestId("puzzle");
      await expect(stage1).toHaveAttribute("data-puzzle-type", "sequence-match");
      for (const symbol of ["Coil", "Sweep", "Slam", "Sweep", "Snap"]) {
        await stage1.getByRole("button", { name: `Add ${symbol}`, exact: true }).click();
      }
      await stage1.getByRole("button", { name: "Check answer" }).click();
      await expect(page.getByTestId("puzzle-solved")).toBeVisible();

      // --- Stage 2: weak points (pair-match) ----------------------------------------------------------
      await page.goto("/child/adventure/skull-reef/krakens-lair");
      await expect(page.getByTestId("puzzle")).toHaveAttribute("data-puzzle-type", "pair-match");
      // The browser never gets the answer.
      expect(
        (await page.content()).match(/[\s\S]{0,60}\bpairs\b[\s\S]{0,60}/)?.[0],
      ).toBeUndefined();
      await page.getByTestId("part-tentacle").click();
      for (const tool of ["net", "shield", "glass", "lantern", "hook"]) {
        await page.getByTestId(`tool-${tool}`).click();
      }
      await page.getByTestId("puzzle-check").click();
      await expect(page.getByTestId("puzzle-solved")).toBeVisible();

      // --- Stage 3: the whirlpool escape (route-plan) -------------------------------------------------
      await page.goto("/child/adventure/skull-reef/whirlpool-gate");
      await expect(page.getByTestId("puzzle")).toHaveAttribute("data-puzzle-type", "route-plan");
      await sail(page, ESCAPE_ROUTE);
      await page.getByTestId("puzzle-check").click();
      await expect(page.getByTestId("puzzle-solved")).toBeVisible();

      // --- The chapter completes, the reward is claimed, and Whispering Jungle opens as a placeholder --
      await page.goto("/child/adventure/skull-reef");
      await expect(page.getByText("Chapter complete!")).toBeVisible();
      await page.getByRole("button", { name: "Claim chapter reward" }).click();
      await expect(page.getByText("Chapter reward claimed")).toBeVisible();
      expect(
        await db.inventoryGrant.count({
          where: { childId: child.id, item: { key: "kraken-tooth" } },
        }),
      ).toBe(1);

      await page.goto("/child/adventure");
      const jungleRow = page
        .getByTestId("chapter-list")
        .locator("li", { hasText: /^5\. Whispering Jungle/ });
      await expect(jungleRow).not.toContainText("Finish");
      const jungle = await db.childChapterProgress.findFirstOrThrow({
        where: { childId: child.id, chapter: { key: "whispering-jungle" } },
      });
      expect(jungle.status).toBe("UNLOCKED");
    } finally {
      await db.family.delete({ where: { id: family.id } }).catch(() => undefined);
      await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("anonymous visitors are sent to sign-in from the reef chart table", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/child/adventure/skull-reef/chart-table");
    await expect(page).toHaveURL(/sign-in/);
    await ctx.close();
  });
});
