import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AssignTaskForm,
  AssignmentStatusButton,
  CreateTaskForm,
} from "@/features/tasks/components/task-forms";
import { prisma } from "@/lib/db/prisma";
import { todayIn } from "@/lib/utils/dates";
import { requireParentContext } from "@/server/policies/context";
import { listChildren } from "@/server/services/child.service";
import { listTaskPresets, listTasks } from "@/server/services/task.service";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const ctx = await requireParentContext();
  const [presets, tasks, children, assignments] = await Promise.all([
    listTaskPresets(prisma),
    listTasks(prisma, ctx.familyId),
    listChildren(prisma, ctx.familyId),
    prisma.taskAssignment.findMany({
      where: { familyId: ctx.familyId, status: { not: "ARCHIVED" } },
      include: { task: true, child: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Tasks"
        description="One shared task library. Assign tasks to children with a schedule, or reuse them in routines."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New task</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateTaskForm presets={presets} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assign a task</CardTitle>
          </CardHeader>
          <CardContent>
            <AssignTaskForm tasks={tasks} childrenList={children} today={todayIn(ctx.timezone)} />
          </CardContent>
        </Card>
      </div>
      <section className="mt-8">
        <h2 className="mb-3 font-semibold">Task library ({tasks.length})</h2>
        {tasks.length === 0 ? (
          <EmptyState title="No tasks yet" description="Create one above or pick a preset." />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="task-list">
            {tasks.map((task) => (
              <li key={task.id} className="rounded-xl border bg-card px-4 py-3 text-sm">
                <p className="font-medium">{task.title}</p>
                <p className="text-muted-foreground">
                  {task.category.replace("_", " ")} · {task.points} pts ·{" "}
                  {task.approvalPolicy === "AUTO_APPROVE" ? "auto" : "review"} ·{" "}
                  {task._count.assignments} assigned
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-8">
        <h2 className="mb-3 font-semibold">Assignments</h2>
        {assignments.length === 0 ? (
          <EmptyState title="No assignments yet" />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {assignments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                <span>
                  {a.task.title} → {a.child.displayName} ·{" "}
                  {a.frequency.toLowerCase().replace("_", " ")}
                  {a.dueTime ? ` by ${a.dueTime}` : ""}
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={a.status} />
                  <AssignmentStatusButton assignmentId={a.id} status={a.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
