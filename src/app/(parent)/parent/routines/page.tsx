import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AddRoutineStepForm,
  ArchiveRoutineButton,
  AssignRoutineForm,
  CreateRoutineForm,
  EditRoutineAssignmentForm,
  EditRoutineForm,
  RoutineAssignmentStatusButtons,
  StepControls,
} from "@/features/routines/components/routine-forms";
import { StatusBadge } from "@/components/shared/status-badge";
import { prisma } from "@/lib/db/prisma";
import { dbToLocalDate, todayIn } from "@/lib/utils/dates";
import { requireParentContext } from "@/server/policies/context";
import { listChildren } from "@/server/services/child.service";
import {
  listArchivedRoutines,
  listRoutineTemplates,
  listRoutines,
} from "@/server/services/routine.service";
import { listTasks } from "@/server/services/task.service";

export const metadata = { title: "Routines" };

export default async function RoutinesPage() {
  const ctx = await requireParentContext();
  const [templates, routines, archivedRoutines, tasks, children] = await Promise.all([
    listRoutineTemplates(prisma),
    listRoutines(prisma, ctx.familyId),
    listArchivedRoutines(prisma, ctx.familyId),
    listTasks(prisma, ctx.familyId),
    listChildren(prisma, ctx.familyId),
  ]);
  const today = todayIn(ctx.timezone);
  const childName = new Map(children.map((c) => [c.id, c.displayName]));
  return (
    <>
      <PageHeader
        title="Routines"
        description="Ordered steps built from your task library. Steps are the same tasks, not copies."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New routine</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateRoutineForm templates={templates} tasks={tasks} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assign a routine</CardTitle>
          </CardHeader>
          <CardContent>
            <AssignRoutineForm routines={routines} childrenList={children} today={today} />
          </CardContent>
        </Card>
      </div>
      <section className="mt-8 space-y-3" data-testid="routine-list">
        <h2 className="font-semibold">Your routines ({routines.length})</h2>
        {routines.length === 0 ? <EmptyState title="No routines yet" /> : null}
        {routines.map((routine) => (
          <Card key={routine.id}>
            <CardHeader>
              <CardTitle className="text-base">{routine.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <ol className="space-y-1" data-testid="routine-steps">
                {routine.steps.map((step, index) => (
                  <li key={step.id} className="flex items-center justify-between gap-2">
                    <span>
                      {index + 1}. {step.task.title}
                      {step.isOptional ? " (optional)" : ""}
                    </span>
                    <StepControls
                      routineId={routine.id}
                      stepId={step.id}
                      title={step.task.title}
                      isOptional={step.isOptional}
                      isFirst={index === 0}
                      isLast={index === routine.steps.length - 1}
                    />
                  </li>
                ))}
              </ol>
              <details>
                <summary className="cursor-pointer text-primary">Add a step</summary>
                <div className="mt-2">
                  <AddRoutineStepForm
                    routineId={routine.id}
                    tasks={tasks
                      .filter((t) => !routine.steps.some((s) => s.taskId === t.id))
                      .map((t) => ({ id: t.id, title: t.title }))}
                  />
                </div>
              </details>
              <details>
                <summary className="cursor-pointer text-primary">Edit routine</summary>
                <div className="mt-2">
                  <EditRoutineForm routine={routine} />
                </div>
              </details>
              {routine.assignments.length === 0 ? (
                <p>Not assigned yet.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {routine.assignments.map((a) => (
                    <li key={a.id} className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          {childName.get(a.childId) ?? "Archived child"} ·{" "}
                          {a.frequency.toLowerCase().replace("_", " ")}
                          {a.windowStart && a.windowEnd ? ` · ${a.windowStart}–${a.windowEnd}` : ""}
                        </span>
                        <span className="flex items-center gap-2">
                          <StatusBadge status={a.status} />
                          <RoutineAssignmentStatusButtons assignmentId={a.id} status={a.status} />
                        </span>
                      </div>
                      <details className="mt-1">
                        <summary className="cursor-pointer text-primary">Edit schedule</summary>
                        <div className="mt-2">
                          <EditRoutineAssignmentForm
                            today={today}
                            assignment={{
                              id: a.id,
                              frequency: a.frequency,
                              daysOfWeek: a.daysOfWeek,
                              startDate: dbToLocalDate(a.startDate),
                              endDate: a.endDate ? dbToLocalDate(a.endDate) : null,
                              bonusPoints: a.bonusPoints,
                              approvalPolicy: a.approvalPolicy,
                              windowStart: a.windowStart,
                              windowEnd: a.windowEnd,
                            }}
                          />
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
              <ArchiveRoutineButton routineId={routine.id} archived />
            </CardContent>
          </Card>
        ))}
      </section>
      {archivedRoutines.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Archived routines</h2>
          <ul className="divide-y rounded-xl border bg-card" data-testid="archived-routines">
            {archivedRoutines.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{r.name}</span>
                <ArchiveRoutineButton routineId={r.id} archived={false} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
