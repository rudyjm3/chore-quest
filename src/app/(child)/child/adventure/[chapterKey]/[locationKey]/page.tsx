import Link from "next/link";
import { notFound } from "next/navigation";

import { QuestCard } from "@/components/shared/quest-card";
import { Button } from "@/components/ui/button";
import { CollectionSlots } from "@/features/adventures/components/collection-slots";
import { PuzzlePanel } from "@/features/adventures/components/puzzle-panel";
import { buildLocationView } from "@/features/adventures/location-view";
import { describeReward } from "@/features/adventures/quest-board";
import { prisma } from "@/lib/db/prisma";
import { requireChildContext } from "@/server/policies/context";
import { getAdventureState } from "@/server/services/adventure.service";

export async function generateMetadata({
  params,
}: PageProps<"/child/adventure/[chapterKey]/[locationKey]">) {
  const { locationKey } = await params;
  return { title: locationKey.replaceAll("-", " ") };
}

/** A place inside a chapter scene (ADR 0015): the feather grove's quest, the compass shrine's puzzle. */
export default async function LocationPage({
  params,
}: PageProps<"/child/adventure/[chapterKey]/[locationKey]">) {
  const { chapterKey, locationKey } = await params;
  const ctx = await requireChildContext();
  // Own data only: the state is scoped to the signed-in child.
  const state = await getAdventureState(prisma, ctx, "pirate");
  const chapter = state.chapters.find((c) => c.key === chapterKey);
  if (!chapter) notFound();
  const view = buildLocationView(chapter, locationKey);
  if (!view) notFound();

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="min-h-11">
        <Link href={`/child/adventure/${chapter.key}`}>← {chapter.title}</Link>
      </Button>
      <header>
        <p className="text-xs font-bold tracking-widest text-pirate-wood uppercase">
          {chapter.title}
        </p>
        <h1 className="text-3xl font-black">{view.name}</h1>
        {view.description ? <p className="text-muted-foreground">{view.description}</p> : null}
      </header>

      {chapter.status === "LOCKED" ? (
        <p className="rounded-3xl border-4 border-pirate-wood bg-pirate-parchment p-6 text-center text-lg">
          🔒 This place is still hidden in the mist. Finish earlier chapters first!
        </p>
      ) : view.kind === "quest-board" ? (
        <div className="space-y-4" data-testid="location-quest">
          {view.collections.map((slot) => (
            <div
              key={slot.key}
              className="rounded-3xl border-4 border-pirate-wood bg-pirate-parchment p-4"
            >
              <CollectionSlots slot={slot} />
            </div>
          ))}
          <QuestCard
            title={view.quest.title}
            description={view.quest.description}
            kind={view.quest.kind}
            status={view.quest.status}
            objectives={view.quest.objectives}
            reward={describeReward(view.quest.rewards) || undefined}
          />
        </div>
      ) : (
        <PuzzlePanel
          ctx={ctx}
          adventureKey={state.adventure.key}
          chapterKey={chapter.key}
          puzzleKey={view.puzzleKey}
          available={view.available}
          waitingFor={view.waitingFor}
        />
      )}
    </div>
  );
}
