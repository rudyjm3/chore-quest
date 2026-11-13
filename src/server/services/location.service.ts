import type { Prisma } from "@/generated/prisma/client";
import { chapterConfigSchema, type ChapterLocation } from "@/game/schemas";
import { lockChildRow, type DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { sourceKeys } from "@/lib/utils/source-keys";
import type { ChildContext } from "@/server/policies/context";

import { grantItem } from "./inventory.service";

type Db = Prisma.TransactionClient | DbClient;

export type LocationStatus =
  | { status: "not-started" }
  | { status: "locked"; requiresItemKey: string }
  | { status: "available" }
  | { status: "found" };

interface Resolved {
  progressId: string;
  location: ChapterLocation & { reward: NonNullable<ChapterLocation["reward"]> };
}

/** The child's own progress plus the configured location, or null when the adventure is not started. */
async function resolve(
  db: Db,
  ctx: ChildContext,
  p: { adventureKey: string; chapterKey: string; locationKey: string },
): Promise<Resolved | null> {
  const adventure = await db.adventure.findUnique({ where: { key: p.adventureKey } });
  if (!adventure || !adventure.isActive) throw AppError.notFound("Adventure");
  const progress = await db.childAdventureProgress.findFirst({
    where: { childId: ctx.childId, familyId: ctx.familyId, adventureId: adventure.id },
  });
  if (!progress) return null;
  const chapter = await db.adventureChapter.findFirst({
    where: { adventureId: adventure.id, key: p.chapterKey },
  });
  if (!chapter) throw AppError.notFound("Place");
  const chapterProgress = await db.childChapterProgress.findFirst({
    where: { childId: ctx.childId, adventureProgressId: progress.id, chapterId: chapter.id },
  });
  // A place in a chapter the child has not reached is treated as unknown.
  if (!chapterProgress || chapterProgress.status === "LOCKED") throw AppError.notFound("Place");
  const location = chapterConfigSchema
    .parse(chapter.config)
    .locations.find((l) => l.key === p.locationKey);
  if (!location?.reward) throw AppError.notFound("Place");
  return { progressId: progress.id, location: { ...location, reward: location.reward } };
}

async function statusFor(db: Db, ctx: ChildContext, chapterKey: string, r: Resolved) {
  const found = await db.inventoryGrant.findFirst({
    where: {
      childId: ctx.childId,
      sourceKey: sourceKeys.locationItem(
        r.progressId,
        chapterKey,
        r.location.key,
        r.location.reward.itemKey,
      ),
    },
    select: { id: true },
  });
  if (found) return { status: "found" } as const satisfies LocationStatus;
  const need = r.location.requiresItemKey;
  if (need) {
    const owned = await db.childInventoryItem.findFirst({
      where: {
        childId: ctx.childId,
        familyId: ctx.familyId,
        quantity: { gt: 0 },
        item: { key: need },
      },
      select: { id: true },
    });
    if (!owned)
      return { status: "locked", requiresItemKey: need } as const satisfies LocationStatus;
  }
  return { status: "available" } as const satisfies LocationStatus;
}

/** What the child sees at a place with a one-time reward. Own data only. */
export async function getLocationStatus(
  db: DbClient,
  ctx: ChildContext,
  p: { adventureKey: string; chapterKey: string; locationKey: string },
): Promise<LocationStatus & { name?: string; description?: string | undefined }> {
  const resolved = await resolve(db, ctx, p);
  if (!resolved) return { status: "not-started" };
  return {
    ...(await statusFor(db, ctx, p.chapterKey, resolved)),
    name: resolved.location.name,
    description: resolved.location.description,
  };
}

/**
 * First visit grants the location's one-time item reward (ADR 0014). Child row lock first, state
 * re-read under it, grant keyed per child and place: repeats and races grant nothing more.
 */
export async function visitLocation(
  db: DbClient,
  ctx: ChildContext,
  p: { adventureKey: string; chapterKey: string; locationKey: string },
) {
  return db.$transaction(async (tx) => {
    await lockChildRow(tx, ctx.childId);
    const resolved = await resolve(tx, ctx, p);
    if (!resolved) throw AppError.invalidState("Start your adventure first");
    const current = await statusFor(tx, ctx, p.chapterKey, resolved);
    if (current.status === "found")
      return { granted: false as const, itemKey: resolved.location.reward.itemKey };
    if (current.status === "locked") {
      throw AppError.invalidState("You need something special to look here");
    }
    const { reward } = resolved.location;
    const result = await grantItem(tx, {
      familyId: ctx.familyId,
      childId: ctx.childId,
      itemKey: reward.itemKey,
      quantity: reward.quantity,
      sourceType: "LOCATION_REWARD",
      sourceKey: sourceKeys.locationItem(
        resolved.progressId,
        p.chapterKey,
        resolved.location.key,
        reward.itemKey,
      ),
    });
    return { granted: result.created, itemKey: reward.itemKey };
  });
}
