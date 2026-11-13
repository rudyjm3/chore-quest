import { EmptyState } from "@/components/shared/empty-state";
import { GoalCard } from "@/components/shared/goal-card";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssignGoalForm, CreateGoalForm } from "@/features/goals/components/goal-forms";
import {
  ArchiveGoalButton,
  EditAssignmentForm,
  EditGoalForm,
  RepairGoalButton,
} from "@/features/goals/components/goal-management";
import { prisma } from "@/lib/db/prisma";
import { dbToLocalDate, todayIn } from "@/lib/utils/dates";
import { requireParentContext } from "@/server/policies/context";
import { listChildren } from "@/server/services/child.service";
import { listGoals } from "@/server/services/goal.service";
import { listRoutines } from "@/server/services/routine.service";
import { listTasks } from "@/server/services/task.service";

export const metadata = { title: "Goals" };

export default async function GoalsPage() {
  const ctx = await requireParentContext();
  const [goals, archivedGoals, tasks, routines, children] = await Promise.all([
    listGoals(prisma, ctx.familyId),
    listGoals(prisma, ctx.familyId, { archived: true }),
    listTasks(prisma, ctx.familyId),
    listRoutines(prisma, ctx.familyId),
    listChildren(prisma, ctx.familyId),
  ]);
  return (
    <>
      <PageHeader
        title="Goals"
        description="Goals track verified completions. The same chore can count toward several goals."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New goal</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateGoalForm tasks={tasks} routines={routines} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assign a goal</CardTitle>
          </CardHeader>
          <CardContent>
            <AssignGoalForm goals={goals} childrenList={children} today={todayIn(ctx.timezone)} />
          </CardContent>
        </Card>
      </div>
      <section className="mt-8 space-y-4">
        <h2 className="font-semibold">Goal progress</h2>
        {goals.length === 0 ? <EmptyState title="No goals yet" /> : null}
        {goals.map((goal) => (
          <div key={goal.id} className="space-y-2" data-testid="goal-row">
            <p className="text-sm font-medium">
              {goal.title}{" "}
              <span className="text-muted-foreground">
                · {goal.type.toLowerCase().replaceAll("_", " ")} · target {goal.targetCount}
              </span>
            </p>
            {goal.assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not assigned yet.</p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {goal.assignments.map((a) => (
                <GoalCard
                  key={a.id}
                  title={a.child.displayName}
                  description={a.periodKey ? a.periodKey.replace("week:", "Week of ") : undefined}
                  progress={a.progressCount}
                  target={a.targetOverride ?? goal.targetCount}
                  status={a.status}
                  streak={goal.type === "CONSECUTIVE_DAYS" ? a.currentStreak : undefined}
                  rewardPoints={goal.rewardPoints}
                />
              ))}
            </div>
            <details className="rounded-xl border bg-card p-3">
              <summary className="cursor-pointer text-sm font-medium">Edit “{goal.title}”</summary>
              <div className="mt-3 space-y-5">
                <EditGoalForm goal={goal} />
                {goal.assignments.length > 0 ? (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-sm font-semibold">Assignments</h3>
                    {goal.assignments.map((a) => (
                      <EditAssignmentForm
                        key={a.id}
                        goalTarget={goal.targetCount}
                        assignment={{
                          id: a.id,
                          childName: a.periodKey
                            ? `${a.child.displayName} · ${a.periodKey.replace("week:", "week of ")}`
                            : a.child.displayName,
                          startDate: dbToLocalDate(a.startDate),
                          endDate: a.endDate ? dbToLocalDate(a.endDate) : null,
                          targetOverride: a.targetOverride,
                          weekly: a.periodKey !== "",
                          status: a.status,
                        }}
                      />
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <ArchiveGoalButton goalId={goal.id} archived={false} />
                  <RepairGoalButton goalId={goal.id} />
                </div>
              </div>
            </details>
          </div>
        ))}
      </section>
      {archivedGoals.length > 0 ? (
        <section className="mt-8 space-y-2" aria-labelledby="archived-goals">
          <h2 id="archived-goals" className="font-semibold">
            Archived goals
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {archivedGoals.map((goal) => (
              <li
                key={goal.id}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
              >
                <span>{goal.title}</span>
                <ArchiveGoalButton goalId={goal.id} archived />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
