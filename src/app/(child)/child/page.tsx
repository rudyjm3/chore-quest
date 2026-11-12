import { ChildTodayList } from "@/features/approvals/components/child-today";
import { prisma } from "@/lib/db/prisma";
import { todayIn } from "@/lib/utils/dates";
import { requireChildContext } from "@/server/policies/context";
import { ensureRoutineRuns, listVisibleRunsForChild } from "@/server/services/routine.service";
import { ensureTaskOccurrences, listOccurrencesForChild } from "@/server/services/task.service";

export const metadata = { title: "Today" };

export default async function ChildHomePage() {
  const ctx = await requireChildContext();
  const family = await prisma.family.findUniqueOrThrow({
    where: { id: ctx.familyId },
    select: { timezone: true },
  });
  const today = todayIn(family.timezone);
  await ensureTaskOccurrences(prisma, {
    familyId: ctx.familyId,
    childId: ctx.childId,
    from: today,
    to: today,
  });
  await ensureRoutineRuns(prisma, {
    familyId: ctx.familyId,
    childId: ctx.childId,
    from: today,
    to: today,
  });
  const [occurrences, runs] = await Promise.all([
    listOccurrencesForChild(prisma, {
      familyId: ctx.familyId,
      childId: ctx.childId,
      from: today,
      to: today,
    }),
    listVisibleRunsForChild(prisma, {
      familyId: ctx.familyId,
      childId: ctx.childId,
      today,
      timezone: family.timezone,
    }),
  ]);
  return (
    <ChildTodayList
      occurrences={occurrences.map((o) => ({
        id: o.id,
        title: o.assignment.task.title,
        points: o.pointsSnapshot,
        status: o.status,
        dueTime: o.assignment.dueTime,
      }))}
      runs={runs.map((run) => ({
        id: run.id,
        name: run.assignment.routine.name,
        status: run.status,
        bonusPoints: run.bonusPointsSnapshot,
        window:
          run.assignment.windowStart && run.assignment.windowEnd
            ? `${run.assignment.windowStart}–${run.assignment.windowEnd}`
            : null,
        steps: run.assignment.routine.steps.map((step) => ({
          stepId: step.id,
          title: step.task.title,
          isOptional: step.isOptional,
          status: run.stepProgress.find((p) => p.stepId === step.id)?.status ?? "PENDING",
        })),
      }))}
    />
  );
}
