import { randomUUID } from "node:crypto";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { AdjustmentForm } from "@/features/rewards/components/adjustment-form";
import {
  ArchiveRewardButton,
  ResolveRedemptionForm,
  RewardForm,
} from "@/features/rewards/components/reward-catalogue";
import { prisma } from "@/lib/db/prisma";
import { requireParentContext } from "@/server/policies/context";
import { listChildren } from "@/server/services/child.service";
import {
  getWallets,
  listLedger,
  listRedemptionsForFamily,
  listRewardDefinitions,
} from "@/server/services/reward.service";

export const metadata = { title: "Rewards" };

export default async function RewardsPage() {
  const ctx = await requireParentContext();
  const [children, catalogue, openRequests] = await Promise.all([
    listChildren(prisma, ctx.familyId),
    listRewardDefinitions(prisma, ctx.familyId, { includeArchived: true }),
    listRedemptionsForFamily(prisma, ctx.familyId, { statuses: ["REQUESTED", "APPROVED"] }),
  ]);
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
      <section
        className="mb-8 space-y-3"
        aria-labelledby="requests-heading"
        data-testid="redemption-requests"
      >
        <h2 id="requests-heading" className="font-semibold">
          Reward requests
        </h2>
        <p className="text-sm text-muted-foreground">
          Points are set aside the moment a child asks. Declining gives them back.
        </p>
        {openRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests waiting.</p>
        ) : null}
        {openRequests.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {r.rewardDefinition.title}{" "}
                  <span className="text-muted-foreground">· {r.child.displayName}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {r.costPoints} points <StatusBadge status={r.status} className="ml-1" />
                </p>
              </div>
              <ResolveRedemptionForm
                redemptionId={r.id}
                status={r.status === "REQUESTED" ? "REQUESTED" : "APPROVED"}
              />
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="mb-8 space-y-3" aria-labelledby="catalogue-heading">
        <h2 id="catalogue-heading" className="font-semibold">
          Reward shop
        </h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a reward</CardTitle>
          </CardHeader>
          <CardContent>
            <RewardForm />
          </CardContent>
        </Card>
        {catalogue.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rewards yet. Add one above.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card" data-testid="reward-catalogue">
            {catalogue.map((reward) => (
              <li key={reward.id} className="space-y-2 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span>
                    <span className="font-medium">{reward.title}</span>{" "}
                    <span className="text-muted-foreground">
                      · {reward.costPoints} points ·{" "}
                      {reward.stock === null ? "unlimited" : `${reward.stock} left`}
                    </span>
                    {reward.isActive ? null : <StatusBadge status="ARCHIVED" className="ml-2" />}
                  </span>
                  <ArchiveRewardButton rewardId={reward.id} active={reward.isActive} />
                </div>
                <details>
                  <summary className="cursor-pointer text-muted-foreground">Edit</summary>
                  <div className="mt-3">
                    <RewardForm
                      reward={{
                        id: reward.id,
                        title: reward.title,
                        description: reward.description,
                        costPoints: reward.costPoints,
                        stock: reward.stock,
                      }}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
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
