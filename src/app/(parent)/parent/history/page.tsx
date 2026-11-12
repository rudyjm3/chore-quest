import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { HistoryList } from "@/features/history/components/history-list";
import { prisma } from "@/lib/db/prisma";
import { isLocalDate } from "@/lib/utils/dates";
import { requireParentContext } from "@/server/policies/context";
import { listChildren } from "@/server/services/child.service";
import { listActivityHistory } from "@/server/services/history.service";

export const metadata = { title: "Activity history" };

type Search = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireParentContext();
  const sp = await searchParams;
  const children = await listChildren(prisma, ctx.familyId);
  // Unknown / malformed filters are ignored rather than trusted.
  const childId = children.find((c) => c.id === first(sp.child))?.id;
  const from = isLocalDate(first(sp.from)) ? first(sp.from) : undefined;
  const to = isLocalDate(first(sp.to)) ? first(sp.to) : undefined;
  const rangeInvalid = Boolean(from && to && from > to);
  const page = rangeInvalid
    ? { items: [], nextCursor: null }
    : await listActivityHistory(prisma, {
        familyId: ctx.familyId,
        childId,
        from,
        to,
        cursor: first(sp.cursor),
      });

  const nextParams = new URLSearchParams();
  if (childId) nextParams.set("child", childId);
  if (from) nextParams.set("from", from);
  if (to) nextParams.set("to", to);
  if (page.nextCursor) nextParams.set("cursor", page.nextCursor);

  return (
    <>
      <PageHeader
        title="Activity history"
        description="Approved chores and routines, newest first."
      />
      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-3 text-sm"
        aria-label="Filter history"
      >
        <div className="space-y-1">
          <label htmlFor="child" className="block text-xs">
            Child
          </label>
          <select
            id="child"
            name="child"
            defaultValue={childId ?? ""}
            className="h-9 rounded-md border bg-background px-3"
          >
            <option value="">Everyone</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="from" className="block text-xs">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="h-9 rounded-md border bg-background px-3"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="to" className="block text-xs">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="h-9 rounded-md border bg-background px-3"
          />
        </div>
        <Button type="submit" size="sm">
          Filter
        </Button>
      </form>
      {rangeInvalid ? (
        <p role="alert" className="text-sm text-danger">
          The start date must be on or before the end date.
        </p>
      ) : (
        <HistoryList items={page.items} showChild emptyText="No activity in this range yet." />
      )}
      {page.nextCursor ? (
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href={`/parent/history?${nextParams.toString()}`}>Older activity</Link>
          </Button>
        </div>
      ) : null}
    </>
  );
}
