import type { DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";

import {
  chapterConfigSchema,
  questConfigSchema,
  type ChapterConfig,
  type QuestConfig,
} from "../schemas";

/**
 * Loads chapter definitions from the database and validates their JSON config
 * so the rest of the engine works with typed data only.
 */
export interface LoadedChapter {
  id: string;
  key: string;
  sortOrder: number;
  title: string;
  subtitle: string | null;
  locationName: string;
  status: "PLAYABLE" | "PLACEHOLDER";
  config: ChapterConfig;
  quests: Array<{
    id: string;
    key: string;
    kind: "MAIN" | "SIDE";
    title: string;
    rewardCoins: number;
    rewardXp: number;
    config: QuestConfig;
    objectives: Array<{
      id: string;
      key: string;
      type: string;
      targetCount: number;
      config: unknown;
      title: string;
    }>;
  }>;
}

export async function loadAdventureChapters(
  db: DbClient,
  adventureId: string,
): Promise<LoadedChapter[]> {
  const chapters = await db.adventureChapter.findMany({
    where: { adventureId },
    orderBy: { sortOrder: "asc" },
    include: {
      quests: {
        orderBy: { sortOrder: "asc" },
        include: { objectives: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  return chapters.map((chapter) => ({
    id: chapter.id,
    key: chapter.key,
    sortOrder: chapter.sortOrder,
    title: chapter.title,
    subtitle: chapter.subtitle,
    locationName: chapter.locationName,
    status: chapter.status,
    config: chapterConfigSchema.parse(chapter.config),
    quests: chapter.quests.map((quest) => ({
      id: quest.id,
      key: quest.key,
      kind: quest.kind,
      title: quest.title,
      rewardCoins: quest.rewardCoins,
      rewardXp: quest.rewardXp,
      config: questConfigSchema.parse(quest.config),
      objectives: quest.objectives.map((o) => ({
        id: o.id,
        key: o.key,
        type: o.type,
        targetCount: o.targetCount,
        config: o.config,
        title: o.title,
      })),
    })),
  }));
}

export async function loadChapterByKey(db: DbClient, adventureId: string, chapterKey: string) {
  const chapters = await loadAdventureChapters(db, adventureId);
  const chapter = chapters.find((c) => c.key === chapterKey);
  if (!chapter) throw AppError.notFound("Chapter");
  return chapter;
}
