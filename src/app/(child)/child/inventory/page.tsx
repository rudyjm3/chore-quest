import { ItemArt } from "@/components/shared/item-art";
import { RarityBadge } from "@/components/shared/rarity-badge";
import { getItemAsset } from "@/game/themes";
import { prisma } from "@/lib/db/prisma";
import { requireChildContext } from "@/server/policies/context";
import { getInventory } from "@/server/services/inventory.service";

export const metadata = { title: "Treasure chest" };

const GROUPS: Array<{ type: string; title: string }> = [
  { type: "SHIP", title: "Ships" },
  { type: "SHIP_UPGRADE", title: "Ship upgrades" },
  { type: "COSMETIC", title: "Dress-up" },
  { type: "COLLECTIBLE", title: "Collectibles" },
  { type: "RESOURCE", title: "Supplies" },
  { type: "CONSUMABLE", title: "Consumables" },
];

export default async function ChildInventoryPage() {
  const ctx = await requireChildContext();
  // Scoped to this child only; the service filters by childId.
  const rows = await getInventory(prisma, ctx.childId);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">Treasure chest</h1>
      {rows.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-pirate-wood/40 p-6 text-center">
          Nothing in your chest yet. Finish quests to fill it!
        </p>
      ) : null}
      {GROUPS.map((group) => {
        const items = rows.filter((r) => r.item.type === group.type);
        if (items.length === 0) return null;
        return (
          <section key={group.type} className="space-y-3" aria-labelledby={`inv-${group.type}`}>
            <h2 id={`inv-${group.type}`} className="text-xl font-black">
              {group.title}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2" data-testid={`inventory-${group.type}`}>
              {items.map((row) => (
                <li
                  key={row.id}
                  className="flex gap-3 rounded-2xl border-2 border-pirate-wood/30 bg-card p-3"
                >
                  <ItemArt
                    asset={getItemAsset(row.item.adventure?.themeKey, row.item.iconKey)}
                    itemType={row.item.type}
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="font-bold">
                      {row.item.name}{" "}
                      <span className="text-muted-foreground">× {row.quantity}</span>
                    </p>
                    <RarityBadge rarity={row.item.rarity} />
                    {row.item.description ? (
                      <p className="text-sm text-muted-foreground">{row.item.description}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
