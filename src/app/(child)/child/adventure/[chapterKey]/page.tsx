import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { QuestCard } from "@/components/shared/quest-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ClaimChapterRewardButton } from "@/features/adventures/components/adventure-actions";
import { PuzzlePanel } from "@/features/adventures/components/puzzle-panel";
import { locationHasPage } from "@/features/adventures/location-view";
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
  // Each puzzle is paired with the quest objective that uses it (display gate only; the server re-checks).
  const puzzleObjectives =
    chapter.status === "LOCKED" ? [] : chapter.quests.flatMap((q) => q.objectives);

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
          {chapter.locations.map((location) => {
            const label = (
              <>
                {location.kind === "npc"
                  ? "🧑‍✈️ "
                  : location.kind === "shop"
                    ? "🏪 "
                    : location.kind === "puzzle"
                      ? "🧩 "
                      : "📍 "}
                {location.name}
              </>
            );
            const position = { left: `${location.position.x}%`, top: `${location.position.y}%` };
            const base =
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-xl bg-pirate-ink/80 px-2 py-1 text-xs font-bold text-white";
            return locationHasPage(location) ? (
              <Link
                key={location.key}
                href={`/child/adventure/${chapter.key}/${location.key}`}
                className={`${base} flex min-h-11 min-w-11 items-center justify-center bg-pirate-gold! text-pirate-ink! ring-2 ring-white focus-visible:ring-4`}
                style={position}
                title={location.description}
                data-testid="scene-location-link"
              >
                <span className="animate-bob inline-block" aria-hidden="true">
                  ✨
                </span>
                {label}
              </Link>
            ) : (
              <div
                key={location.key}
                className={base}
                style={position}
                title={location.description}
              >
                {label}
              </div>
            );
          })}
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

      {chapter.status === "LOCKED"
        ? null
        : chapter.puzzles.map((puzzle) => {
            const objective = puzzleObjectives.find(
              (o) => o.type === "COMPLETE_PUZZLE" && o.puzzleKey === puzzle.key,
            );
            const waitingFor =
              objective && !objective.available
                ? (chapter.quests
                    .flatMap((q) => q.objectives)
                    .find((o) => o.key !== objective.key && !o.completed)?.title ?? null)
                : null;
            return (
              <PuzzlePanel
                key={puzzle.id}
                ctx={ctx}
                adventureKey={state.adventure.key}
                chapterKey={chapter.key}
                puzzleKey={puzzle.key}
                available={objective?.available ?? true}
                waitingFor={waitingFor}
              />
            );
          })}
    </div>
  );
}
