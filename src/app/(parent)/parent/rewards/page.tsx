import { randomUUID } from "node:crypto";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdjustmentForm } from "@/features/rewards/components/adjustment-form";
import { prisma } from "@/lib/db/prisma";
import { requireParentContext } from "@/server/policies/context";
import { listChildren } from "@/server/services/child.service";
import { getWallets, listLedger } from "@/server/services/reward.service";

export const metadata = { title: "Rewards" };

export default async function RewardsPage() {
  const ctx = await requireParentContext();
  const children = await listChildren(prisma, ctx.familyId);
  const rows = await Promise.all(
    children.map(async (child) => ({
      child,
      wallets: await getWallets(prisma, child.id),
      ledger: await listLedger(prisma, child.id, 10),
    })),
  );
  return (
    <>
      <PageHeader
        title="Rewards"
        description="Points are yours to control. Coins and XP belong to the adventure. Every change is a ledger entry."
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Manual adjustment</CardTitle>
        </CardHeader>
        <CardContent>
          <AdjustmentForm childrenList={children} idempotencyKey={randomUUID()} />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2" data-testid="wallets">
        {rows.map(({ child, wallets, ledger }) => (
          <Card key={child.id}>
            <CardHeader>
              <CardTitle className="text-base">{child.displayName}</CardTitle>
              <p className="text-sm text-muted-foreground">
                ⭐ {wallets.POINTS} points · 🪙 {wallets.COINS} coins · ✨ {wallets.XP} XP
              </p>
            </CardHeader>
            <CardContent>
              {ledger.entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No transactions yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {ledger.entries.map((e) => (
                    <li key={e.id} className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">
                        {e.description ?? e.sourceType.toLowerCase().replaceAll("_", " ")}
                      </span>
                      <span className={e.amount > 0 ? "text-success" : "text-danger"}>
                        {e.amount > 0 ? "+" : ""}
                        {e.amount} {e.currency.toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
