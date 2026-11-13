import { cn } from "@/lib/utils";

const RARITY = {
  COMMON: { label: "Common", marks: "◆", style: "border-border bg-muted text-foreground" },
  UNCOMMON: {
    label: "Uncommon",
    marks: "◆◆",
    style: "border-emerald-700 bg-emerald-50 text-emerald-900",
  },
  RARE: {
    label: "Rare",
    marks: "◆◆◆",
    style: "border-sky-700 bg-sky-50 text-sky-900 border-dashed",
  },
  EPIC: {
    label: "Epic",
    marks: "◆◆◆◆",
    style: "border-purple-700 bg-purple-50 text-purple-900 border-double border-4",
  },
  LEGENDARY: {
    label: "Legendary",
    marks: "★★★★★",
    style: "border-amber-600 bg-amber-50 text-amber-900 border-double border-4",
  },
} as const;

/**
 * Rarity is shown with a word, a count of marks and a border style as well as a colour, so it never
 * relies on colour alone.
 */
export function RarityBadge({ rarity }: { rarity: string }) {
  const entry = RARITY[rarity as keyof typeof RARITY] ?? RARITY.COMMON;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold",
        entry.style,
      )}
      data-rarity={rarity}
    >
      <span aria-hidden>{entry.marks}</span>
      {entry.label}
    </span>
  );
}
