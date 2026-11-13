import { randomUUID } from "node:crypto";

import { ItemArt } from "@/components/shared/item-art";
import { RarityBadge } from "@/components/shared/rarity-badge";
import { Card, CardContent } from "@/components/ui/card";
import { PurchaseButton } from "@/features/shop/components/purchase-button";
import { getItemAsset } from "@/game/themes";
import { prisma } from "@/lib/db/prisma";
import { requireChildContext } from "@/server/policies/context";
import { listShopItems } from "@/server/services/inventory.service";

export const metadata = { title: "Supply shop" };
// Idempotency keys are minted per render, so the page must never be served from a cache.
export const dynamic = "force-dynamic";

export default async function ChildSuppliesPage() {
  const ctx = await requireChildContext();
  const { coins, listings } = await listShopItems(prisma, ctx);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">Supply shop</h1>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        You have 🪙 {coins} coins. Earn more by finishing your adventure quests!
      </p>
      {listings.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-pirate-wood/40 p-6 text-center">
          The shop is empty for now. Check back soon!
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="supply-shop">
          {listings.map((item) => {
            const state = item.availability;
            return (
              <li key={item.key}>
                <Card className="h-full border-2 border-pirate-wood/30" data-state={state.status}>
                  <CardContent className="flex gap-3">
                    <ItemArt
                      asset={getItemAsset(item.themeKey, item.iconKey)}
                      itemType={item.type}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-bold">{item.name}</p>
                        <RarityBadge rarity={item.rarity} />
                      </div>
                      {item.description ? (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      ) : null}
                      <p className="text-sm">
                        You have <strong>{item.owned}</strong>
                        {item.maxQuantity !== null ? ` of ${item.maxQuantity}` : ""}
                      </p>
                      {state.status === "max-owned" ? (
                        <p className="font-semibold text-pirate-leaf">✓ {state.reason}</p>
                      ) : (
                        <PurchaseButton
                          itemKey={item.key}
                          itemName={item.name}
                          costCoins={item.costCoins}
                          idempotencyKey={randomUUID()}
                          disabled={state.status !== "available"}
                        />
                      )}
                      {state.status === "cant-afford" || state.status === "locked" ? (
                        <p className="text-sm text-muted-foreground">{state.reason}</p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
