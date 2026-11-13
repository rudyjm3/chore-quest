import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { BulkApproveForm, type BulkItem } from "@/features/approvals/components/bulk-approve-form";
import {
  ReviewOccurrenceButtons,
  ReviewRoutineRunButtons,
} from "@/features/approvals/components/review-buttons";
import { prisma } from "@/lib/db/prisma";
import { dbToLocalDate } from "@/lib/utils/dates";
import { requireParentContext } from "@/server/policies/context";
import { listPendingReviews } from "@/server/services/task.service";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const ctx = await requireParentContext();
  const [occurrences, runs, recent] = await Promise.all([
    listPendingReviews(prisma, ctx.familyId),
    prisma.routineRun.findMany({
      where: { familyId: ctx.familyId, status: "SUBMITTED" },
      include: { child: true, assignment: { include: { routine: true } } },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.activityCompletion.findMany({
      where: { familyId: ctx.familyId },
      orderBy: { approvedAt: "desc" },
      take: 10,
      include: {
        child: { select: { displayName: true } },
        taskOccurrence: { include: { assignment: { include: { task: true } } } },
        routineRun: { include: { assignment: { include: { routine: true } } } },
      },
    }),
  ]);

  const bulkItems: BulkItem[] = [
    ...occurrences.map((o) => ({
      value: `occurrence:${o.id}`,
      title: `${o.assignment.task.title} · ${o.child.displayName}`,
      detail: `${dbToLocalDate(o.localDate)} · ${o.pointsSnapshot} points`,
    })),
    ...runs.map((r) => ({
      value: `routine_run:${r.id}`,
      title: `${r.assignment.routine.name} (routine) · ${r.child.displayName}`,
      detail: `${dbToLocalDate(r.localDate)} · ${r.bonusPointsSnapshot} bonus points`,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Review what your children have marked as done. Approving creates a verified completion and awards points."
      />
      {bulkItems.length > 1 ? (
        <section className="mb-8 space-y-2" aria-labelledby="bulk-heading">
          <h2 id="bulk-heading" className="font-semibold">
            Approve several at once
          </h2>
          <BulkApproveForm items={bulkItems} />
        </section>
      ) : null}
      <section className="space-y-3" data-testid="pending-approvals">
        <h2 className="font-semibold">Review one by one</h2>
        {occurrences.length === 0 && runs.length === 0 ? (
          <EmptyState
            title="Nothing to review"
            description="When a child marks a chore as done it shows up here."
          />
        ) : null}
        {occurrences.map((occurrence) => (
          <Card key={occurrence.id}>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {occurrence.assignment.task.title}{" "}
                  <span className="text-muted-foreground">· {occurrence.child.displayName}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {dbToLocalDate(occurrence.localDate)} · {occurrence.pointsSnapshot} points
                  {occurrence.submission?.note ? ` · “${occurrence.submission.note}”` : ""}
                </p>
              </div>
              <ReviewOccurrenceButtons occurrenceId={occurrence.id} />
            </CardContent>
          </Card>
        ))}
        {runs.map((run) => (
          <Card key={run.id}>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {run.assignment.routine.name} (routine){" "}
                  <span className="text-muted-foreground">· {run.child.displayName}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {dbToLocalDate(run.localDate)} · {run.bonusPointsSnapshot} bonus points
                </p>
              </div>
              <ReviewRoutineRunButtons runId={run.id} />
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="font-semibold">Recent activity</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approved activity yet.</p>
        ) : null}
        <ul className="divide-y rounded-xl border bg-card">
          {recent.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>
                {c.child.displayName} ·{" "}
                {c.taskOccurrence?.assignment.task.title ??
                  c.routineRun?.assignment.routine.name ??
                  "Activity"}{" "}
                · {dbToLocalDate(c.localDate)}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">+{c.pointsAwarded} pts</span>
                <StatusBadge
                  status={c.processingStatus === "PROCESSED" ? "APPROVED" : c.processingStatus}
                />
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
