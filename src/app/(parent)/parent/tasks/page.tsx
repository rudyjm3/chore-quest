import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AddPresetButton,
  ArchiveAssignmentButton,
  ArchiveTaskButton,
  AssignTaskForm,
  AssignmentStatusButton,
  CreateTaskForm,
  EditAssignmentForm,
  EditTaskForm,
} from "@/features/tasks/components/task-forms";
import { prisma } from "@/lib/db/prisma";
import { dbToLocalDate, todayIn } from "@/lib/utils/dates";
import { requireParentContext } from "@/server/policies/context";
import { listChildren } from "@/server/services/child.service";
import { listArchivedTasks, listTaskPresets, listTasks } from "@/server/services/task.service";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const ctx = await requireParentContext();
  const [presets, tasks, archivedTasks, children, assignments] = await Promise.all([
    listTaskPresets(prisma),
    listTasks(prisma, ctx.familyId),
    listArchivedTasks(prisma, ctx.familyId),
    listChildren(prisma, ctx.familyId),
    prisma.taskAssignment.findMany({
      where: { familyId: ctx.familyId, status: { not: "ARCHIVED" } },
      include: { task: true, child: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const today = todayIn(ctx.timezone);
  const presetGroups = new Map<string, typeof presets>();
  for (const preset of presets) {
    presetGroups.set(preset.category, [...(presetGroups.get(preset.category) ?? []), preset]);
  }

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
            <AssignTaskForm tasks={tasks} childrenList={children} today={today} />
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
                <details className="mt-2">
                  <summary className="cursor-pointer text-primary">Edit</summary>
                  <div className="mt-2">
                    <EditTaskForm task={task} />
                  </div>
                </details>
                <ArchiveTaskButton taskId={task.id} archived />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-8" aria-labelledby="presets-heading">
        <h2 id="presets-heading" className="mb-3 font-semibold">
          Preset browser
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="preset-browser">
          {[...presetGroups.entries()].map(([category, items]) => (
            <details key={category} className="rounded-xl border bg-card px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium">
                {category.replace("_", " ")} ({items.length})
              </summary>
              <ul className="mt-2 divide-y">
                {items.map((p) => (
                  <li key={p.key} className="flex items-center justify-between gap-2 py-1.5">
                    <span>
                      {p.title}{" "}
                      <span className="text-muted-foreground">· {p.defaultPoints} pts</span>
                    </span>
                    <AddPresetButton presetKey={p.key} label={p.title} />
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
      {archivedTasks.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Archived tasks</h2>
          <ul className="divide-y rounded-xl border bg-card" data-testid="archived-tasks">
            {archivedTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{t.title}</span>
                <ArchiveTaskButton taskId={t.id} archived={false} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="mt-8">
        <h2 className="mb-3 font-semibold">Assignments</h2>
        {assignments.length === 0 ? (
          <EmptyState title="No assignments yet" />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {assignments.map((a) => (
              <li key={a.id} className="px-4 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {a.task.title} → {a.child.displayName} ·{" "}
                    {a.frequency.toLowerCase().replace("_", " ")}
                    {a.dueTime ? ` by ${a.dueTime}` : ""}
                    {a.endDate ? ` until ${dbToLocalDate(a.endDate)}` : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={a.status} />
                    <AssignmentStatusButton assignmentId={a.id} status={a.status} />
                    <ArchiveAssignmentButton assignmentId={a.id} />
                  </span>
                </div>
                <details className="mt-1">
                  <summary className="cursor-pointer text-primary">Edit schedule</summary>
                  <div className="mt-2">
                    <EditAssignmentForm
                      today={today}
                      assignment={{
                        id: a.id,
                        frequency: a.frequency,
                        daysOfWeek: a.daysOfWeek,
                        startDate: dbToLocalDate(a.startDate),
                        endDate: a.endDate ? dbToLocalDate(a.endDate) : null,
                        dueTime: a.dueTime,
                        pointsOverride: a.pointsOverride,
                        approvalPolicyOverride: a.approvalPolicyOverride,
                      }}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
