import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssignRoutineForm, CreateRoutineForm } from "@/features/routines/components/routine-forms";
import { prisma } from "@/lib/db/prisma";
import { todayIn } from "@/lib/utils/dates";
import { requireParentContext } from "@/server/policies/context";
import { listChildren } from "@/server/services/child.service";
import { listRoutineTemplates, listRoutines } from "@/server/services/routine.service";
import { listTasks } from "@/server/services/task.service";

export const metadata = { title: "Routines" };

export default async function RoutinesPage() {
  const ctx = await requireParentContext();
  const [templates, routines, tasks, children] = await Promise.all([
    listRoutineTemplates(prisma),
    listRoutines(prisma, ctx.familyId),
    listTasks(prisma, ctx.familyId),
    listChildren(prisma, ctx.familyId),
  ]);
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
            <AssignRoutineForm
              routines={routines}
              childrenList={children}
              today={todayIn(ctx.timezone)}
            />
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
            <CardContent className="text-sm text-muted-foreground">
              <ol className="list-decimal space-y-0.5 pl-5">
                {routine.steps.map((step) => (
                  <li key={step.id}>{step.task.title}</li>
                ))}
              </ol>
              <p className="mt-2">Assigned to {routine.assignments.length} child(ren).</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </>
  );
}
