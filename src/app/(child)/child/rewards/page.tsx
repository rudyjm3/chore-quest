import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { CancelRequestButton } from "@/features/rewards/components/cancel-request-button";
import { RequestRewardButton } from "@/features/rewards/components/request-reward-button";
import { prisma } from "@/lib/db/prisma";
import { requireChildContext } from "@/server/policies/context";
import {
  getWallets,
  listRedemptionsForChild,
  listRewardDefinitions,
} from "@/server/services/reward.service";

export const metadata = { title: "Reward shop" };

export default async function ChildRewardsPage() {
  const ctx = await requireChildContext();
  const [rewards, wallets, requests] = await Promise.all([
    listRewardDefinitions(prisma, ctx.familyId),
    getWallets(prisma, ctx.childId),
    listRedemptionsForChild(prisma, ctx),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">Reward shop</h1>
      <p className="text-sm text-muted-foreground">
        You have ⭐ {wallets.POINTS} points. When you ask for a reward, its points are set aside
        until a grown-up decides. If the answer is no, you get them back.
      </p>
      <section className="space-y-3" data-testid="reward-shop">
        {rewards.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-pirate-wood/40 p-6 text-center">
            The shop is empty. Ask a grown-up to add rewards!
          </p>
        ) : null}
        {rewards.map((reward) => {
          const soldOut = reward.stock !== null && reward.stock <= 0;
          const missing = reward.costPoints - wallets.POINTS;
          const reason = soldOut
            ? "All gone for now."
            : missing > 0
              ? `You need ${missing} more point${missing === 1 ? "" : "s"}.`
              : null;
          return (
            <Card key={reward.id} className="border-2 border-pirate-wood/30">
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-bold">{reward.title}</p>
                  {reward.description ? (
                    <p className="text-sm text-muted-foreground">{reward.description}</p>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    ⭐ {reward.costPoints} points
                    {reward.stock !== null && !soldOut ? ` · ${reward.stock} left` : ""}
                  </p>
                </div>
                <RequestRewardButton rewardId={reward.id} disabledReason={reason} />
              </CardContent>
            </Card>
          );
        })}
      </section>
      <section className="space-y-3" data-testid="my-requests">
        <h2 className="text-xl font-black">My requests</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing asked for yet.</p>
        ) : (
          <ul className="divide-y rounded-2xl border-2 border-pirate-wood/30 bg-card">
            {requests.map((r) => (
              <li key={r.id} className="space-y-0.5 px-4 py-3 text-sm">
                <p className="flex items-center justify-between gap-2 font-medium">
                  {r.rewardDefinition.title}
                  <StatusBadge status={r.status} />
                </p>
                {r.status === "REQUESTED" ? (
                  <CancelRequestButton redemptionId={r.id} title={r.rewardDefinition.title} />
                ) : null}
                {r.resolutionNote ? (
                  <p className="text-muted-foreground">Note: {r.resolutionNote}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
