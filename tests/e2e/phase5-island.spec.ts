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
 * Treasure Island (Phase 5, slice 4): the legendary ship gate, the dig, the three guards, the finale reward and the
 * campaign-complete card. Isolated household built directly in the database and removed afterwards, so the demo
 * family and the rate-limited sign-in endpoints are untouched.
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

const TRAPS = [
  ...["right", "right", "right", "up", "right", "up", "up"],
  ...["left", "left", "left", "up", "left", "up", "up", "up"],
  ...Array<string>(7).fill("right"),
];

test.describe("phase 5: Treasure Island", () => {
  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("legendary ship, the dig, three guards, the finale reward and the end of the campaign", async ({
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
          localDate: `2026-${String(10 + Math.floor(day / 28)).padStart(2, "0")}-${String((day % 28) + 1).padStart(2, "0")}`,
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
    const claim = async (key: string) => claimChapterReward(db, childCtx, await chapterId(key));
    const buy = (itemKey: string) =>
      purchaseItem(db, {
        familyId: family.id,
        childId: child.id,
        itemKey,
        idempotencyKey: `e2e-island-${itemKey}`,
      });

    try {
      // Earlier chapters through the services (covered by earlier specs); only the explorer and voyager are bought.
      await approve(3);
      await claim("home-port");
      await approve(4);
      await solve("compass-puzzle", { sequence: ["N", "E", "S", "W"] });
      await claim("parrot-island");
      await buy("ship-explorer");
      await approve(7);
      await solve("repair-puzzle", {
        pairs: { hull: "hammer", mast: "saw", sail: "needle", wheel: "wrench", anchor: "oil" },
      });
      await claim("shipwreck-cove");
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
      await claim("skull-reef");
      await approve(6);
      await solve("ruins-puzzle", { order: ["statue", "idol", "bowl", "mask", "key"] });
      await solve("temple-glyphs", {
        pairs: { sun: "day", moon: "night", snake: "danger", wave: "water", flame: "warmth" },
      });
      await solve("temple-maze", {
        moves: [
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
        ],
      });
      await claim("whispering-jungle");
      const coins = await db.rewardWallet.findFirstOrThrow({
        where: { childId: child.id, currency: "COINS" },
      });
      expect(coins.balance).toBe(1100); // the legendary ship (1000) is affordable

      await signInChildDirect(page, family.childLoginCode, "Mate");

      // --- Locked until the ship is bought ----------------------------------------------------------
      await page.goto("/child/adventure");
      const islandRow = page
        .getByTestId("chapter-list")
        .locator("li", { hasText: /^6\. Treasure Island/ });
      await expect(islandRow).toContainText("Need Legendary Ship");
      await expect(page.getByTestId("campaign-complete")).toHaveCount(0);
      await page.goto("/child/adventure/treasure-island");
      await expect(page.getByText("still hidden in the mist")).toBeVisible();

      await page.goto("/child/supplies");
      await page.getByTestId("buy-ship-legendary").click();
      await expect(page.locator("[data-sonner-toast]").first()).toContainText(
        "You bought Legendary Ship",
      );
      await page.goto("/child/adventure");
      await expect(islandRow).not.toContainText("Need");

      // --- The island: places with pages; the dig comes first ------------------------------------------
      await page.goto("/child/adventure/treasure-island");
      for (const name of [/Dig Site/, /Chest Cave/, /Trap Tunnel/, /Quest Board/]) {
        const link = page.getByRole("link", { name });
        await expect(link).toBeVisible();
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await page.goto("/child/adventure/treasure-island/dig-site");
      await expect(page.getByTestId("puzzle-waiting")).toContainText("Dig for the treasure");
      await page.goto("/child/adventure/treasure-island/chest-cave");
      await expect(page.getByTestId("puzzle-waiting")).toContainText("Crack Blackbeard");

      await approve(6);

      // --- Guard 1: the lock (sequence), the rhyme is on the page ---------------------------------------
      await page.goto("/child/adventure/treasure-island/dig-site");
      const lock = page.getByTestId("puzzle");
      await expect(lock).toHaveAttribute("data-puzzle-type", "sequence-match");
      for (const symbol of ["Anchor", "Skull", "Cannon", "Skull", "Compass"]) {
        await lock.getByRole("button", { name: `Add ${symbol}`, exact: true }).click();
      }
      await lock.getByRole("button", { name: "Check answer" }).click();
      await expect(page.getByTestId("puzzle-solved")).toBeVisible();

      // --- Guard 2: the runes (clue-order) --------------------------------------------------------------
      await page.goto("/child/adventure/treasure-island/chest-cave");
      await expect(page.getByTestId("puzzle")).toHaveAttribute("data-puzzle-type", "clue-order");
      expect(await page.content()).not.toMatch(/"(solution|order)"/);
      for (const key of ["star", "skull", "crown", "flame", "wave"]) {
        await page.getByTestId(`clue-item-${key}`).click();
      }
      await page.getByTestId("puzzle-check").click();
      await expect(page.getByTestId("puzzle-solved")).toBeVisible();

      // --- Guard 3: the traps (route-plan) ---------------------------------------------------------------
      await page.goto("/child/adventure/treasure-island/trap-tunnel");
      await expect(page.getByTestId("puzzle")).toHaveAttribute("data-puzzle-type", "route-plan");
      await sail(page, TRAPS);
      await page.getByTestId("puzzle-check").click();
      await expect(page.getByTestId("puzzle-solved")).toBeVisible();

      // --- Reward, and the end of the campaign -------------------------------------------------------------
      await page.goto("/child/adventure/treasure-island");
      await expect(page.getByText("Chapter complete!")).toBeVisible();
      await expect(page.getByText(/1000/)).toBeVisible();
      await page.getByRole("button", { name: "Claim chapter reward" }).click();
      await expect(page.getByText("Chapter reward claimed")).toBeVisible();
      const items = await db.childInventoryItem.findMany({
        where: {
          childId: child.id,
          item: {
            key: { in: ["map-fragment", "blackbeards-treasure", "cosmetic-blackbeards-flag"] },
          },
        },
        include: { item: { select: { key: true } } },
      });
      expect(Object.fromEntries(items.map((i) => [i.item.key, i.quantity]))).toEqual({
        "map-fragment": 6,
        "blackbeards-treasure": 1,
        "cosmetic-blackbeards-flag": 1,
      });
      expect(
        await db.notification.count({
          where: { familyId: family.id, kind: "ADVENTURE_COMPLETED" },
        }),
      ).toBe(1);

      await page.goto("/child/adventure");
      await expect(page.getByTestId("campaign-complete")).toContainText("Adventure complete");
    } finally {
      await db.family.delete({ where: { id: family.id } }).catch(() => undefined);
      await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("anonymous visitors are sent to sign-in from the dig site", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/child/adventure/treasure-island/dig-site");
    await expect(page).toHaveURL(/sign-in/);
    await ctx.close();
  });
});
