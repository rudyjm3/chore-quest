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
        parentNote: o.status === "SUBMITTED" ? null : (o.submission?.review?.note ?? null),
      }))}
      runs={runs.map((run) => ({
        id: run.id,
        name: run.assignment.routine.name,
        status: run.status,
        bonusPoints: run.bonusPointsSnapshot,
        parentNote: run.reviewNote,
        window:
          run.assignment.windowStart && run.assignment.windowEnd
            ? `${run.assignment.windowStart}–${run.assignment.windowEnd}`
            : null,
        // A run's steps are its progress rows; retired steps only stay visible on finished runs.
        steps: run.stepProgress
          .filter(
            (p) => !p.step.retiredAt || run.status === "SUBMITTED" || run.status === "APPROVED",
          )
          .map((p) => ({
            stepId: p.stepId,
            title: p.step.task.title,
            isOptional: p.step.isOptional,
            status: p.status,
          })),
      }))}
    />
  );
}
