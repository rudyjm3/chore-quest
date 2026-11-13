import Link from "next/link";

import { ItemArt } from "@/components/shared/item-art";
import { RarityBadge } from "@/components/shared/rarity-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { slotLabel } from "@/features/adventures/crew-camp";
import { EquipButton } from "@/features/adventures/components/equip-button";
import { getItemAsset } from "@/game/themes";
import { prisma } from "@/lib/db/prisma";
import { requireChildContext } from "@/server/policies/context";
import { getCrewCamp } from "@/server/services/crew-camp.service";

export const metadata = { title: "Crew camp" };
export const dynamic = "force-dynamic";

export default async function CrewCampPage() {
  const ctx = await requireChildContext();
  const camp = await getCrewCamp(prisma, ctx, "pirate");
  const slots = Object.entries(camp.slots).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="min-h-11">
        <Link href="/child/port">← Home Port</Link>
      </Button>
      <h1 className="text-2xl font-black">Crew camp</h1>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Pick what your ship and crew wear. It is only for fun!
      </p>
      {!camp.started ? (
        <p className="rounded-2xl border-2 border-dashed border-pirate-wood/40 p-6 text-center">
          Join the crew first.{" "}
          <Link href="/child/adventure" className="font-bold underline">
            Start your adventure
          </Link>
        </p>
      ) : slots.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-pirate-wood/40 p-6 text-center">
          You have nothing to wear yet. Visit the{" "}
          <Link href="/child/supplies" className="font-bold underline">
            Supply shop
          </Link>{" "}
          to get some gear!
        </p>
      ) : (
        slots.map(([slot, items]) => (
          <section key={slot} className="space-y-3" aria-labelledby={`slot-${slot}`}>
            <h2 id={`slot-${slot}`} className="text-xl font-black">
              {slotLabel(slot)}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2" data-testid={`camp-slot-${slot}`}>
              {items.map((item) => (
                <li key={item.key}>
                  <Card
                    className="h-full border-2 border-pirate-wood/30"
                    data-worn={item.equipped ? "true" : "false"}
                  >
                    <CardContent className="flex gap-3">
                      <ItemArt
                        className="border-pirate-wood/30 bg-pirate-parchment"
                        asset={getItemAsset(item.themeKey, item.iconKey)}
                        itemType={item.type}
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-bold">{item.name}</p>
                          <RarityBadge rarity={item.rarity} />
                        </div>
                        {item.equipped ? (
                          <p className="font-semibold text-pirate-leaf">✓ Wearing this</p>
                        ) : null}
                        <EquipButton
                          slot={slot}
                          itemKey={item.key}
                          itemName={item.name}
                          worn={item.equipped}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
