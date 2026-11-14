import { itemSlot } from "@/features/adventures/crew-camp";
import { parseAdventureState } from "@/game/schemas";
import { lockChildRow, type DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import type { ChildContext } from "@/server/policies/context";

export interface CrewCampItem {
  key: string;
  name: string;
  description: string | null;
  type: string;
  rarity: string;
  iconKey: string | null;
  themeKey: string | null;
  slot: string;
  equipped: boolean;
}

/** What the child owns that can be worn, grouped by slot, with what is currently worn. Own data only. */
export async function getCrewCamp(db: DbClient, ctx: ChildContext, adventureKey: string) {
  const adventure = await db.adventure.findUnique({
    where: { key: adventureKey },
    select: { id: true, themeKey: true },
  });
  if (!adventure) throw AppError.notFound("Adventure");
  const progress = await db.childAdventureProgress.findUnique({
    where: { childId_adventureId: { childId: ctx.childId, adventureId: adventure.id } },
    select: { state: true },
  });
  const rows = await db.childInventoryItem.findMany({
    where: { childId: ctx.childId, familyId: ctx.familyId, quantity: { gt: 0 } },
    include: { item: true },
    orderBy: { acquiredAt: "asc" },
  });
  const equipped = parseAdventureState(progress?.state).equipped;
  const slots: Record<string, CrewCampItem[]> = {};
  for (const row of rows) {
    const slot = itemSlot(row.item.config);
    if (!slot || !row.item.isActive) continue;
    (slots[slot] ??= []).push({
      key: row.item.key,
      name: row.item.name,
      description: row.item.description,
      type: row.item.type,
      rarity: row.item.rarity,
      iconKey: row.item.iconKey,
      themeKey: adventure.themeKey,
      slot,
      equipped: equipped[slot] === row.item.key,
    });
  }
  return { started: Boolean(progress), slots };
}

/**
 * Wear (`itemKey` set) or take off (`itemKey` null) a cosmetic. Lock child → re-read progress →
 * check ownership and slot, then write the small state. Never read for rewards or progress.
 */
export async function equipCosmetic(
  db: DbClient,
  ctx: ChildContext,
  params: { adventureKey: string; slot: string; itemKey: string | null },
) {
  return db.$transaction(async (tx) => {
    await lockChildRow(tx, ctx.childId);
    const adventure = await tx.adventure.findUnique({ where: { key: params.adventureKey } });
    if (!adventure || !adventure.isActive) throw AppError.notFound("Adventure");
    // Re-read after taking the lock so a concurrent equip is never overwritten.
    const progress = await tx.childAdventureProgress.findFirst({
      where: { childId: ctx.childId, familyId: ctx.familyId, adventureId: adventure.id },
    });
    if (!progress) throw AppError.invalidState("Start your adventure first");

    const state = parseAdventureState(progress.state);
    const equipped = { ...state.equipped };

    if (params.itemKey === null) {
      delete equipped[params.slot];
    } else {
      const item = await tx.itemDefinition.findUnique({ where: { key: params.itemKey } });
      if (!item || !item.isActive) throw AppError.notFound("Item");
      const owned = await tx.childInventoryItem.findFirst({
        where: {
          childId: ctx.childId,
          familyId: ctx.familyId,
          itemId: item.id,
          quantity: { gt: 0 },
        },
        select: { id: true },
      });
      if (!owned) throw AppError.invalidState("You do not have this yet");
      if (itemSlot(item.config) !== params.slot) {
        throw AppError.invalidState("That does not fit in this spot");
      }
      equipped[params.slot] = item.key;
    }

    await tx.childAdventureProgress.update({
      where: { id: progress.id },
      data: { state: { ...state, equipped } },
    });
    return { equipped };
  });
}
