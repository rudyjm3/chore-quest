import { GoalCard } from "@/components/shared/goal-card";
import { prisma } from "@/lib/db/prisma";
import { requireChildContext } from "@/server/policies/context";
import { listGoalsForChild } from "@/server/services/goal.service";

export const metadata = { title: "Goals" };

export default async function ChildGoalsPage() {
  const ctx = await requireChildContext();
  const assignments = await listGoalsForChild(prisma, ctx.familyId, ctx.childId);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">My goals</h1>
      {assignments.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-pirate-wood/40 p-6 text-center">
          No goals yet. Ask a grown-up to set one!
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {assignments.map((a) => (
          <GoalCard
            key={a.id}
            title={a.goal.title}
            description={a.goal.description}
            progress={a.progressCount}
            target={a.targetOverride ?? a.goal.targetCount}
            status={a.status}
            streak={a.goal.type === "CONSECUTIVE_DAYS" ? a.currentStreak : undefined}
            rewardPoints={a.goal.rewardPoints}
          />
        ))}
      </div>
    </div>
  );
}
