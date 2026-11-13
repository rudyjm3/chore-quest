import Link from "next/link";

import { QuestCard } from "@/components/shared/quest-card";
import { Button } from "@/components/ui/button";
import { buildQuestBoard, describeReward } from "@/features/adventures/quest-board";
import { prisma } from "@/lib/db/prisma";
import { requireChildContext } from "@/server/policies/context";
import { getAdventureState } from "@/server/services/adventure.service";

export const metadata = { title: "Quest board" };

export default async function QuestBoardPage() {
  const ctx = await requireChildContext();
  // Own data only: getAdventureState is scoped to ctx.childId. Progress comes from the engine.
  const state = await getAdventureState(prisma, ctx, "pirate");
  const board = state.started ? buildQuestBoard(state.chapters) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="min-h-11">
          <Link href="/child/port">← Home Port</Link>
        </Button>
      </div>
      <h1 className="text-2xl font-black">Quest board</h1>
      {!state.started ? (
        <p className="rounded-2xl border-2 border-dashed border-pirate-wood/40 p-6 text-center">
          The board is empty until you join the crew.{" "}
          <Link href="/child/adventure" className="font-bold underline">
            Start your adventure
          </Link>
        </p>
      ) : board.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-pirate-wood/40 p-6 text-center">
          No open quests right now. Finish your chores and new ones will appear!
        </p>
      ) : (
        board.map((section) => (
          <section
            key={section.chapterKey}
            className="space-y-3"
            aria-labelledby={`board-${section.chapterKey}`}
          >
            <h2 id={`board-${section.chapterKey}`} className="text-lg font-black">
              {section.chapterTitle}
            </h2>
            <div className="space-y-3" data-testid="quest-board">
              {section.quests.map((quest) => (
                <QuestCard
                  key={quest.key}
                  title={quest.title}
                  description={quest.description}
                  kind={quest.kind}
                  status={quest.status}
                  objectives={quest.objectives}
                  reward={describeReward(quest.rewards) || undefined}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
