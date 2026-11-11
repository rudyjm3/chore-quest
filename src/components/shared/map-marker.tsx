import Link from "next/link";

import { cn } from "@/lib/utils";

export type MarkerState = "locked" | "unlocked" | "current" | "completed";

/**
 * Interactive world-map marker positioned in percent coordinates so artwork
 * can change size freely. State styling is independent of the background art.
 */
export function MapMarker({
  x,
  y,
  label,
  state,
  href,
}: {
  x: number;
  y: number;
  label: string;
  state: MarkerState;
  href?: string;
}) {
  const classes = cn(
    "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 focus:outline-none",
    state === "locked" && "opacity-60",
  );
  const dot = cn(
    "flex size-10 items-center justify-center rounded-full border-4 text-lg shadow-lg transition-transform sm:size-12",
    state === "locked" && "border-muted bg-muted text-muted-foreground",
    state === "unlocked" && "border-pirate-gold bg-pirate-parchment",
    state === "current" && "border-pirate-gold bg-pirate-gold animate-pulse-ring",
    state === "completed" && "border-pirate-leaf bg-pirate-leaf text-white",
    href && "group-hover:scale-110 group-focus-visible:scale-110",
  );
  const icon = state === "completed" ? "✓" : state === "locked" ? "🔒" : "⚓";
  const content = (
    <>
      <span className={dot} aria-hidden>
        {icon}
      </span>
      <span className="rounded-md bg-pirate-ink/80 px-2 py-0.5 text-xs font-semibold text-white">
        {label}
      </span>
    </>
  );
  const style = { left: `${x}%`, top: `${y}%` };
  if (!href) {
    return (
      <div
        className={classes}
        style={style}
        data-testid="map-marker"
        data-state={state}
        aria-label={`${label} (${state})`}
      >
        {content}
      </div>
    );
  }
  return (
    <Link
      href={href}
      className={cn(classes, "group")}
      style={style}
      data-testid="map-marker"
      data-state={state}
      aria-label={`${label} (${state})`}
    >
      {content}
    </Link>
  );
}
