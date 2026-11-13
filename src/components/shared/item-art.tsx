import Image from "next/image";

import type { AssetEntry } from "@/game/schemas";
import { cn } from "@/lib/utils";

const FALLBACK_ICON: Record<string, string> = {
  RESOURCE: "📦",
  COLLECTIBLE: "💎",
  COSMETIC: "🎩",
  SHIP: "⛵",
  SHIP_UPGRADE: "🔧",
  CONSUMABLE: "🧪",
};

/** Item picture from a manifest asset, or a neutral emoji when the theme has no art yet. */
export function ItemArt({
  asset,
  itemType,
  className,
}: {
  asset: AssetEntry | null;
  itemType: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-16 shrink-0 items-center justify-center rounded-2xl border-2 border-pirate-wood/30 bg-pirate-parchment text-3xl",
        className,
      )}
    >
      {asset ? (
        <Image
          src={asset.path}
          alt={asset.alt}
          width={asset.width}
          height={asset.height}
          className="size-12 object-contain"
        />
      ) : (
        <span aria-hidden>{FALLBACK_ICON[itemType] ?? "🎁"}</span>
      )}
    </span>
  );
}
