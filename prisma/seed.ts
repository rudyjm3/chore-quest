/**
 * Idempotent reference-data seed. Safe to run in every environment, including
 * production: it only upserts global catalogues keyed by stable identifiers.
 *
 *   pnpm db:seed            (alias for `prisma db seed`)
 *
 * It never creates families, children, completions or reward transactions.
 * For a demo household use `pnpm db:seed:dev` (development only).
 */
import "dotenv/config";

import type { Prisma } from "../src/generated/prisma/client";
import { adventureThemes } from "../src/game/themes";
import { createPrismaClient } from "../src/lib/db/prisma";
import { routineTemplates, taskPresets } from "./seed-data/task-presets";

export async function seedReferenceData(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required to seed");
  const prisma = createPrismaClient(databaseUrl);
  const summary = {
    presets: 0,
    routineTemplates: 0,
    adventures: 0,
    chapters: 0,
    quests: 0,
    items: 0,
    achievements: 0,
  };
  try {
    // --- Task presets ---------------------------------------------------------
    const presetByKey = new Map<string, string>();
    for (const preset of taskPresets) {
      const row = await prisma.taskPreset.upsert({
        where: { key: preset.key },
        create: { ...preset },
        update: { ...preset, isActive: true },
      });
      presetByKey.set(preset.key, row.id);
      summary.presets += 1;
    }

    // --- Routine templates -----------------------------------------------------
    for (const template of routineTemplates) {
      const { presetKeys, ...data } = template;
      const row = await prisma.routineTemplate.upsert({
        where: { key: template.key },
        create: data,
        update: { ...data, isActive: true },
      });
      // Steps are replaced wholesale so re-ordering a template is a seed edit.
      await prisma.routineTemplateStep.deleteMany({ where: { templateId: row.id } });
      await prisma.routineTemplateStep.createMany({
        data: presetKeys.map((key, index) => ({
          templateId: row.id,
          presetId: presetByKey.get(key)!,
          sortOrder: index + 1,
        })),
      });
      summary.routineTemplates += 1;
    }

    // --- Adventures ------------------------------------------------------------
    for (const { definition } of Object.values(adventureThemes)) {
      const adventure = await prisma.adventure.upsert({
        where: { key: definition.key },
        create: {
          key: definition.key,
          title: definition.title,
          description: definition.description,
          themeKey: definition.themeKey,
          version: definition.version,
          config: definition.config,
        },
        update: {
          title: definition.title,
          description: definition.description,
          themeKey: definition.themeKey,
          version: definition.version,
          config: definition.config,
          isActive: true,
        },
      });
      summary.adventures += 1;

      for (const item of definition.items) {
        const data = {
          ...item,
          config: item.config as Prisma.InputJsonValue,
          adventureId: adventure.id,
        };
        await prisma.itemDefinition.upsert({
          where: { key: item.key },
          create: data,
          update: { ...data, isActive: true },
        });
        summary.items += 1;
      }

      for (const chapter of definition.chapters) {
        const chapterRow = await prisma.adventureChapter.upsert({
          where: { adventureId_key: { adventureId: adventure.id, key: chapter.key } },
          create: {
            adventureId: adventure.id,
            key: chapter.key,
            sortOrder: chapter.sortOrder,
            title: chapter.title,
            subtitle: chapter.subtitle,
            locationName: chapter.locationName,
            description: chapter.description,
            status: chapter.status,
            config: chapter.config,
          },
          update: {
            sortOrder: chapter.sortOrder,
            title: chapter.title,
            subtitle: chapter.subtitle,
            locationName: chapter.locationName,
            description: chapter.description,
            status: chapter.status,
            config: chapter.config,
          },
        });
        summary.chapters += 1;

        for (const [questIndex, quest] of chapter.quests.entries()) {
          const questRow = await prisma.adventureQuest.upsert({
            where: { chapterId_key: { chapterId: chapterRow.id, key: quest.key } },
            create: {
              chapterId: chapterRow.id,
              key: quest.key,
              kind: quest.kind,
              sortOrder: questIndex + 1,
              title: quest.title,
              description: quest.description,
              rewardCoins: quest.rewardCoins,
              rewardXp: quest.rewardXp,
              config: quest.config,
            },
            update: {
              kind: quest.kind,
              sortOrder: questIndex + 1,
              title: quest.title,
              description: quest.description,
              rewardCoins: quest.rewardCoins,
              rewardXp: quest.rewardXp,
              config: quest.config,
            },
          });
          summary.quests += 1;
          for (const [objIndex, objective] of quest.objectives.entries()) {
            await prisma.questObjective.upsert({
              where: { questId_key: { questId: questRow.id, key: objective.key } },
              create: {
                questId: questRow.id,
                key: objective.key,
                type: objective.type,
                sortOrder: objIndex + 1,
                title: objective.title,
                targetCount: objective.targetCount,
                config: objective.config,
              },
              update: {
                type: objective.type,
                sortOrder: objIndex + 1,
                title: objective.title,
                targetCount: objective.targetCount,
                config: objective.config,
              },
            });
          }
        }

        for (const puzzle of chapter.puzzles) {
          await prisma.puzzleDefinition.upsert({
            where: { chapterId_key: { chapterId: chapterRow.id, key: puzzle.key } },
            create: {
              chapterId: chapterRow.id,
              key: puzzle.key,
              title: puzzle.title,
              type: puzzle.type,
              config: puzzle.config as Prisma.InputJsonValue,
            },
            update: {
              title: puzzle.title,
              type: puzzle.type,
              config: puzzle.config as Prisma.InputJsonValue,
            },
          });
        }
      }

      for (const achievement of definition.achievements) {
        await prisma.achievementDefinition.upsert({
          where: { key: achievement.key },
          create: { ...achievement, adventureKey: definition.key },
          update: { ...achievement, adventureKey: definition.key, isActive: true },
        });
        summary.achievements += 1;
      }
    }
    return summary;
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun = process.argv[1]?.endsWith("seed.ts");
if (isDirectRun) {
  seedReferenceData()
    .then((summary) => {
      console.log("Seed complete:", summary);
    })
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
    });
}
