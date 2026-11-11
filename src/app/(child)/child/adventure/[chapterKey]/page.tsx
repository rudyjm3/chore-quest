import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { QuestCard } from "@/components/shared/quest-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  ClaimChapterRewardButton,
  SequencePuzzle,
} from "@/features/adventures/components/adventure-actions";
import { puzzleConfigSchema } from "@/game/schemas";
import { getAssetManifest } from "@/game/themes";
import { prisma } from "@/lib/db/prisma";
import { requireChildContext } from "@/server/policies/context";
import { getAdventureState } from "@/server/services/adventure.service";

export default async function ChapterPage({ params }: PageProps<"/child/adventure/[chapterKey]">) {
  const { chapterKey } = await params;
  const ctx = await requireChildContext();
  const state = await getAdventureState(prisma, ctx, "pirate");
  const chapter = state.chapters.find((c) => c.key === chapterKey);
  if (!chapter) notFound();

  const manifest = getAssetManifest(state.adventure.themeKey);
  const scene = chapter.sceneAssetKey
    ? manifest?.assets.find((a) => a.id === chapter.sceneAssetKey)
    : undefined;
  const puzzles =
    chapter.status === "LOCKED"
      ? []
      : await prisma.puzzleDefinition.findMany({ where: { chapterId: chapter.id } });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/child/adventure">← Map</Link>
        </Button>
        <StatusBadge status={chapter.status} />
      </div>
      <header>
        <p className="text-xs font-bold tracking-widest text-pirate-wood uppercase">
          Chapter {chapter.sortOrder}
        </p>
        <h1 className="text-3xl font-black">{chapter.title}</h1>
        <p className="text-muted-foreground">{chapter.subtitle}</p>
      </header>

      {chapter.status === "LOCKED" ? (
        <p className="rounded-3xl border-4 border-pirate-wood bg-pirate-parchment p-6 text-center text-lg">
          🔒 This island is still hidden in the mist. Finish earlier chapters first!
        </p>
      ) : null}

      {chapter.status !== "LOCKED" ? (
        <div
          className="relative aspect-video w-full overflow-hidden rounded-3xl border-4 border-pirate-wood bg-pirate-sea"
          data-testid="chapter-scene"
        >
          {scene ? (
            <Image
              src={scene.path}
              alt={scene.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
            />
          ) : null}
          {chapter.locations.map((location) => (
            <div
              key={location.key}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xl bg-pirate-ink/80 px-2 py-1 text-xs font-bold text-white"
              style={{ left: `${location.position.x}%`, top: `${location.position.y}%` }}
              title={location.description}
            >
              {location.kind === "npc"
                ? "🧑‍✈️ "
                : location.kind === "shop"
                  ? "🏪 "
                  : location.kind === "puzzle"
                    ? "🧩 "
                    : "📍 "}
              {location.name}
            </div>
          ))}
        </div>
      ) : null}

      {chapter.definitionStatus === "PLACEHOLDER" && chapter.status !== "LOCKED" ? (
        <p className="rounded-3xl border-4 border-dashed border-pirate-wood/50 p-6 text-center">
          🚧 This chapter is still being charted by the mapmakers. Check back soon!
        </p>
      ) : null}

      {chapter.status === "COMPLETED" && !chapter.rewardClaimed ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border-4 border-pirate-gold bg-pirate-gold/30 p-6 text-center">
          <p className="text-lg font-black">Chapter complete! 🏴‍☠️</p>
          <p className="text-sm">
            Reward: 🪙 {chapter.rewards.coins} · ✨ {chapter.rewards.xp} XP
            {chapter.rewards.items
              .map((i) => ` · ${i.quantity}× ${i.itemKey.replaceAll("-", " ")}`)
              .join("")}
          </p>
          <ClaimChapterRewardButton chapterId={chapter.id} />
        </div>
      ) : null}
      {chapter.rewardClaimed ? (
        <p className="text-center text-sm text-muted-foreground">Chapter reward claimed ✅</p>
      ) : null}

      <section className="space-y-3" data-testid="quests">
        {chapter.quests.map((quest) => (
          <QuestCard
            key={quest.key}
            title={quest.title}
            description={quest.description}
            kind={quest.kind}
            status={quest.status}
            objectives={quest.objectives}
          />
        ))}
      </section>

      {puzzles.map((puzzle) => {
        const config = puzzleConfigSchema.parse(puzzle.config);
        const data = config.data as { symbols?: string[]; hint?: string };
        const objective = chapter.quests
          .flatMap((q) => q.objectives)
          .find((o) => o.type === "COMPLETE_PUZZLE");
        if (objective?.completed)
          return (
            <p key={puzzle.id} className="text-center text-sm">
              🧩 {puzzle.title} solved!
            </p>
          );
        return (
          <SequencePuzzle
            key={puzzle.id}
            puzzleId={puzzle.id}
            title={puzzle.title}
            symbols={data.symbols ?? []}
            hint={data.hint}
          />
        );
      })}
    </div>
  );
}
