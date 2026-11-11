import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { addDays, todayIn } from "@/lib/utils/dates";
import { requireParentContext } from "@/server/policies/context";
import { listChildren } from "@/server/services/child.service";
import { ensureRoutineRuns } from "@/server/services/routine.service";
import { ensureTaskOccurrences } from "@/server/services/task.service";

export const metadata = { title: "Dashboard" };

export default async function ParentDashboardPage() {
  const ctx = await requireParentContext();
  const today = todayIn(ctx.timezone);
  // Materialize the coming week (idempotent). A scheduled job will take over in a later milestone.
  await ensureTaskOccurrences(prisma, {
    familyId: ctx.familyId,
    from: today,
    to: addDays(today, 7),
  });
  await ensureRoutineRuns(prisma, { familyId: ctx.familyId, from: today, to: addDays(today, 7) });

  const [children, pendingReviews, pendingRuns, approvedToday] = await Promise.all([
    listChildren(prisma, ctx.familyId),
    prisma.taskOccurrence.count({ where: { familyId: ctx.familyId, status: "SUBMITTED" } }),
    prisma.routineRun.count({ where: { familyId: ctx.familyId, status: "SUBMITTED" } }),
    prisma.activityCompletion.count({
      where: { familyId: ctx.familyId, localDate: new Date(`${today}T00:00:00Z`) },
    }),
  ]);

  return (
    <>
      <PageHeader title="Dashboard" description={`Today is ${today} in ${ctx.timezone}.`} />
      <div className="grid gap-4 sm:grid-cols-3" data-testid="dashboard-stats">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Waiting for review
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <span className="text-3xl font-bold">{pendingReviews + pendingRuns}</span>
            <Button asChild size="sm" variant="outline">
              <Link href="/parent/approvals">Review</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{approvedToday}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Children</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <span className="text-3xl font-bold">{children.length}</span>
            <Button asChild size="sm" variant="outline">
              <Link href="/parent/children">Manage</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      {children.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Add your first child"
            description="Children get a name and a PIN. No email, no surname, no birthday required."
            action={
              <Button asChild>
                <Link href="/parent/children">Add a child</Link>
              </Button>
            }
          />
        </div>
      ) : null}
    </>
  );
}
