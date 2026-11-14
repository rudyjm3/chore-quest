import "dotenv/config";

import { expect, test, type Page } from "@playwright/test";

import { createPrismaClient } from "@/lib/db/prisma";
import { reviewOccurrence } from "@/server/services/approval.service";
import { startAdventure } from "@/server/services/adventure.service";

import {
  createChildFixture,
  createFamilyFixture,
  createOccurrenceFixture,
  createTaskFixture,
} from "../helpers/fixtures";

/**
 * Parrot Island: feather grove, compass shrine and the richer puzzle screen. The family is created
 * directly in the database (an isolated household, removed afterwards) so the test does not depend on,
 * or disturb, the demo family, and does not touch the rate-limited sign-in endpoints.
 */
const db = createPrismaClient(process.env.DATABASE_URL ?? "");
const PIN = "4321";

async function signInChildDirect(page: Page, familyCode: string, name: string) {
  await page.goto("/child/sign-in");
  await page.getByLabel("Family code").fill(familyCode);
  await page.getByRole("button", { name: "Find my crew" }).click();
  await page.getByLabel(name).check();
  await page.getByLabel("Secret PIN").fill(PIN);
  await page.getByRole("button", { name: "Set sail!" }).click();
  await page.waitForURL("**/child");
}

test.describe("phase 4: Parrot Island feather grove and compass puzzle", () => {
  test.afterAll(async () => {
    await db.$disconnect();
  });

  test("feather grove progress, locked shrine, puzzle feedback, animation and sound", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "mutating flow runs once, on desktop");
    test.setTimeout(180_000);

    const { user, family, ctx } = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, family.id, "Scout", PIN);
    const task = await createTaskFixture(db, family.id, { points: 5 });
    await startAdventure(db, { familyId: family.id, childId: child.id, adventureKey: "pirate" });
    let day = 1;
    const approve = async (times: number) => {
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

    try {
      await approve(3); // Home Port done, Parrot Island unlocked
      await approve(2); // two compass feathers
      await signInChildDirect(page, family.childLoginCode, "Scout");

      // --- Feather grove -------------------------------------------------------------------
      await page.goto("/child/adventure/parrot-island");
      const grove = page.getByRole("link", { name: /Feather Grove/ });
      await expect(grove).toBeVisible();
      expect((await grove.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await grove.click();
      await expect(page.getByRole("heading", { name: "Feather Grove", exact: true })).toBeVisible();
      const slots = page.getByTestId("collection-slots");
      await expect(slots).toHaveAttribute("data-collected", "2");
      await expect(slots.locator("li")).toHaveCount(4);
      await expect(slots.locator('li[data-filled="true"]')).toHaveCount(2);
      await expect(page.getByTestId("quest-card")).toContainText("Recover the Compass");
      await expect(page.getByText("2 of 4 found")).toBeVisible();
      await page
        .getByRole("link", { name: /Parrot Island/ })
        .first()
        .click();

      // --- Shrine locked until the feathers are in ----------------------------------------------
      await page.getByRole("link", { name: /Compass Shrine/ }).click();
      await expect(
        page.getByRole("heading", { name: "Compass Shrine", exact: true }),
      ).toBeVisible();
      await expect(page.getByTestId("puzzle-waiting")).toContainText("Collect 4 compass feathers");
      await expect(page.getByTestId("puzzle")).toHaveCount(0);

      await approve(2);
      await page.reload();
      const puzzle = page.getByTestId("puzzle");
      await expect(puzzle).toBeVisible();

      // --- Puzzle: building, undo, clear ---------------------------------------------------------
      const seq = page.getByTestId("puzzle-sequence").locator("li");
      const symbol = (s: string) => puzzle.getByRole("button", { name: `Add ${s}`, exact: true });
      for (const s of ["N", "E", "S", "W"]) {
        expect((await symbol(s).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await symbol("E").click();
      await symbol("N").click();
      await expect(seq).toHaveCount(2);
      await expect(page.getByTestId("puzzle-announce")).toContainText("Added N. 2 chosen.");
      await puzzle.getByRole("button", { name: /Undo/ }).click();
      await expect(seq).toHaveCount(1);
      await symbol("S").click();
      await puzzle.getByRole("button", { name: "Clear" }).click();
      await expect(puzzle.getByText("Tap the symbols below in order.")).toBeVisible();
      await expect(puzzle.getByRole("button", { name: "Check answer" })).toBeDisabled();

      // --- Wrong attempt: server verdict, vague words, wobble animation --------------------------
      await symbol("E").click();
      await symbol("N").click();
      await symbol("S").click();
      await symbol("W").click();
      await puzzle.getByRole("button", { name: "Check answer" }).click();
      const feedback = page.getByTestId("puzzle-feedback");
      await expect(feedback).toHaveAttribute("data-kind", "wrong");
      await expect(feedback).toContainText("Not quite");
      const text = (await feedback.textContent()) ?? "";
      expect(text).not.toMatch(/\d/); // no "2 of 4 right"
      expect(text).not.toMatch(/\b[NESW]\b/); // never names a symbol
      await expect(page.getByTestId("puzzle-sequence").locator("li")).toHaveCount(4); // picks kept for fixing
      const needle = page.locator(".cq-needle");
      await expect(needle).toHaveAttribute("data-needle", "wobble");
      expect(await needle.evaluate((el) => getComputedStyle(el).animationName)).toBe(
        "cq-needle-wobble",
      );
      // The wrong attempt was recorded server-side and nothing was granted.
      expect(await db.puzzleAttempt.count({ where: { childId: child.id, status: "FAILED" } })).toBe(
        1,
      );
      expect(
        await db.puzzleAttempt.count({ where: { childId: child.id, status: "COMPLETED" } }),
      ).toBe(0);

      // prefers-reduced-motion switches the animation off (the text feedback still appears).
      await page.emulateMedia({ reducedMotion: "reduce" });
      await puzzle.getByRole("button", { name: "Clear" }).click();
      await symbol("W").click();
      await symbol("E").click();
      await puzzle.getByRole("button", { name: "Check answer" }).click();
      await expect(feedback).toHaveAttribute("data-kind", "wrong");
      await expect(needle).toHaveAttribute("data-needle", "wobble");
      expect(await needle.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
      await page.emulateMedia({ reducedMotion: "no-preference" });

      // --- Sound toggle: off by default, remembered on this device only ---------------------------
      const sound = page.getByTestId("sound-toggle");
      await expect(sound).toHaveAttribute("aria-pressed", "false");
      expect((await sound.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await sound.click();
      await expect(sound).toHaveAttribute("aria-pressed", "true");
      expect(await page.evaluate(() => localStorage.getItem("cq.scene.sound"))).toBe("1");
      await page.reload();
      await expect(page.getByTestId("sound-toggle")).toHaveAttribute("aria-pressed", "true");
      await page.getByTestId("sound-toggle").click();
      await expect(page.getByTestId("sound-toggle")).toHaveAttribute("aria-pressed", "false");

      // --- Solve it ---------------------------------------------------------------------------
      // (the reload above emptied the picks)
      for (const s of ["N", "E", "S", "W"]) await symbol(s).click();
      await page.getByRole("button", { name: "Check answer" }).click();
      await expect(page.getByTestId("puzzle-solved")).toBeVisible();
      await expect(page.getByTestId("puzzle-feedback")).toHaveAttribute("data-kind", "solved");
      await expect(page.locator(".cq-needle")).toHaveAttribute("data-needle", /spin|idle/);
      // Animation and sound state never reach the database: the adventure state holds only gameplay data.
      const progress = await db.childAdventureProgress.findFirstOrThrow({
        where: { childId: child.id },
      });
      expect(JSON.stringify(progress.state)).not.toMatch(/sound|needle|celebration|wobble|spin/i);

      // The puzzle stays solved after a reload, on the chapter page as well.
      await page.reload();
      await expect(page.getByTestId("puzzle-solved")).toBeVisible();
      await page.goto("/child/adventure/parrot-island");
      await expect(page.getByTestId("puzzle-solved")).toBeVisible();

      // Unknown and non-page locations are 404s, not empty pages.
      const missing = await page.goto("/child/adventure/parrot-island/beach");
      expect(missing?.status()).toBe(404);
    } finally {
      await db.family.delete({ where: { id: family.id } }).catch(() => undefined);
      await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("anonymous visitors are sent to sign-in from the location pages", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    for (const path of [
      "/child/adventure/parrot-island/feather-grove",
      "/child/adventure/parrot-island/compass-shrine",
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/sign-in/);
    }
    await ctx.close();
  });
});
