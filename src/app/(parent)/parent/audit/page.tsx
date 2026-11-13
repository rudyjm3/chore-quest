import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUDIT_FILTERS } from "@/features/audit/summary";
import { prisma } from "@/lib/db/prisma";
import { isLocalDate } from "@/lib/utils/dates";
import { uuidSchema } from "@/lib/validation/common";
import { requireParentContext } from "@/server/policies/context";
import { listAuditLog } from "@/server/services/audit.service";
import Link from "next/link";

export const metadata = { title: "Activity log" };

const first = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

export default async function AuditPage({ searchParams }: PageProps<"/parent/audit">) {
  const ctx = await requireParentContext();
  const params = await searchParams;
  const prefix = AUDIT_FILTERS.find((f) => f.prefix === first(params.prefix))?.prefix;
  const from = first(params.from);
  const to = first(params.to);
  const cursor = uuidSchema.safeParse(first(params.cursor));
  const { entries, nextCursor } = await listAuditLog(prisma, ctx, {
    prefix,
    from: from && isLocalDate(from) ? from : undefined,
    to: to && isLocalDate(to) ? to : undefined,
    cursor: cursor.success ? cursor.data : undefined,
  });

  const query = new URLSearchParams();
  if (prefix) query.set("prefix", prefix);
  if (from && isLocalDate(from)) query.set("from", from);
  if (to && isLocalDate(to)) query.set("to", to);
  const olderQuery = new URLSearchParams(query);
  if (nextCursor) olderQuery.set("cursor", nextCursor);

  return (
    <>
      <PageHeader
        title="Activity log"
        description="A record of approvals, reward changes and family changes. Visible to owners and guardians only."
      />
      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-3"
        aria-label="Filter the log"
      >
        <div className="space-y-1.5">
          <Label htmlFor="prefix">What</Label>
          <select
            id="prefix"
            name="prefix"
            defaultValue={prefix ?? ""}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Everything</option>
            {AUDIT_FILTERS.map((f) => (
              <option key={f.prefix} value={f.prefix}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={from} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={to} />
        </div>
        <Button type="submit" size="sm">
          Apply
        </Button>
        {query.size > 0 ? (
          <Link href="/parent/audit" className="text-sm text-brand hover:underline">
            Clear
          </Link>
        ) : null}
      </form>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing matches these filters.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card" data-testid="audit-list">
          {entries.map((e) => (
            <li key={e.id} className="px-4 py-2.5 text-sm">
              <p>{e.summary}</p>
              <p className="text-xs text-muted-foreground">
                {e.actorLabel} ·{" "}
                <time dateTime={e.createdAt.toISOString()}>
                  {e.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                </time>
              </p>
            </li>
          ))}
        </ul>
      )}
      {nextCursor ? (
        <Link
          href={`/parent/audit?${olderQuery.toString()}`}
          className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
        >
          Older entries
        </Link>
      ) : null}
    </>
  );
}
