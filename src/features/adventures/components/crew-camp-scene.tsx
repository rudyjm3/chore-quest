import Image from "next/image";

import { ItemArt } from "@/components/shared/item-art";
import type { AssetEntry } from "@/game/schemas";
import { getItemAsset } from "@/game/themes";

import type { SceneSlotView } from "../crew-camp";

/**
 * Dressed-up ship showing what the child wears per slot (ADR 0018). Read-only: wearing and taking off
 * stay in the picker below it. Theme-neutral; the ship art and slot positions are passed in.
 */
export function CrewCampScene({
  themeKey,
  ship,
  slots,
}: {
  themeKey: string;
  ship: AssetEntry | null;
  slots: SceneSlotView[];
}) {
  return (
    <figure
      className="space-y-2"
      aria-label="Your ship and what the crew wears"
      data-testid="crew-camp-scene"
    >
      <div className="relative mx-auto aspect-4/3 w-full max-w-md overflow-hidden rounded-3xl border-2 border-pirate-wood/40 bg-linear-to-b from-pirate-sea/30 to-pirate-sea-deep/60">
        {ship ? (
          <span className="animate-sway absolute inset-x-[15%] inset-y-[5%] block origin-bottom">
            <Image
              src={ship.path}
              alt=""
              width={ship.width}
              height={ship.height}
              className="size-full object-contain"
              priority={false}
            />
          </span>
        ) : (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center text-7xl">
            ⛵
          </span>
        )}
        {slots.map((s) => (
          <div
            key={s.slot}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
            data-testid={`scene-slot-${s.slot}`}
            data-worn={s.worn ? "true" : "false"}
            role="img"
            aria-label={s.worn ? `${s.label}: ${s.worn.name}` : `${s.label}: nothing yet`}
          >
            {s.worn ? (
              <ItemArt
                className="size-14 border-pirate-gold bg-pirate-parchment"
                asset={getItemAsset(themeKey, s.worn.iconKey)}
                itemType={s.worn.type}
              />
            ) : (
              <span
                aria-hidden
                className="flex size-14 items-center justify-center rounded-2xl border-2 border-dashed border-pirate-parchment/80 bg-pirate-parchment/20 text-xs font-bold text-pirate-parchment"
              >
                {s.label}
              </span>
            )}
          </div>
        ))}
      </div>
      <figcaption className="text-center text-sm text-muted-foreground">
        {slots.some((s) => s.worn)
          ? "Your ship is dressed for adventure!"
          : "Pick something below to dress your ship."}
      </figcaption>
    </figure>
  );
}
