import Link from "next/link";

import { Button } from "@/components/ui/button";
import { HistoryList } from "@/features/history/components/history-list";
import { prisma } from "@/lib/db/prisma";
import { requireChildContext } from "@/server/policies/context";
import { listActivityHistory } from "@/server/services/history.service";

export const metadata = { title: "My history" };

export default async function ChildHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireChildContext();
  const sp = await searchParams;
  const raw = Array.isArray(sp.cursor) ? sp.cursor[0] : sp.cursor;
  // The child id always comes from the session, never from the URL.
  const page = await listActivityHistory(prisma, {
    familyId: ctx.familyId,
    childId: ctx.childId,
    cursor: raw,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">My history</h1>
      <HistoryList
        items={page.items}
        showChild={false}
        emptyText="Nothing finished yet. You can do it!"
      />
      {page.nextCursor ? (
        <Button asChild variant="secondary" className="rounded-xl font-bold">
          <Link href={`/child/history?cursor=${encodeURIComponent(page.nextCursor)}`}>Older</Link>
        </Button>
      ) : null}
    </div>
  );
}
