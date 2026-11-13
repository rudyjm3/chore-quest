import type { DbClient } from "@/lib/db/prisma";
import type { ChildContext } from "@/server/policies/context";

export interface AchievementGalleryItem {
  key: string;
  title: string;
  iconKey: string | null;
  earned: boolean;
  earnedAt: Date | null;
  /** Shown only once earned. */
  description: string | null;
  /** Shown only while locked: a nudge, never the actual condition. */
  hint: string | null;
}

export const GENERIC_ACHIEVEMENT_HINT =
  "Keep going on your adventure to find out how to unlock this one!";

/**
 * The child's achievement gallery. Locked achievements expose only a hint: the description (which
 * usually spells out the condition) and the criteria stay on the server until the badge is earned.
 * Scoped to the child's own family and id.
 */
export async function listAchievementGallery(
  db: DbClient,
  ctx: ChildContext,
): Promise<AchievementGalleryItem[]> {
  const [definitions, earned] = await Promise.all([
    db.achievementDefinition.findMany({
      where: { isActive: true },
      orderBy: [{ adventureKey: "asc" }, { createdAt: "asc" }, { key: "asc" }],
      select: { id: true, key: true, title: true, description: true, hint: true, iconKey: true },
    }),
    db.earnedAchievement.findMany({
      where: { familyId: ctx.familyId, childId: ctx.childId },
      select: { achievementId: true, earnedAt: true },
    }),
  ]);
  const earnedAt = new Map(earned.map((e) => [e.achievementId, e.earnedAt]));
  return definitions.map((d) => {
    const at = earnedAt.get(d.id) ?? null;
    return {
      key: d.key,
      title: d.title,
      iconKey: d.iconKey,
      earned: at !== null,
      earnedAt: at,
      description: at ? d.description : null,
      hint: at ? null : (d.hint ?? GENERIC_ACHIEVEMENT_HINT),
    };
  });
}
