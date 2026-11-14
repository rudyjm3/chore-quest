import type { CollectionSlot } from "../location-view";

/** Row of big round slots: filled for each thing found, empty for each still to find. */
export function CollectionSlots({ slot }: { slot: CollectionSlot }) {
  return (
    <div className="space-y-2" data-testid="collection-slots" data-collected={slot.current}>
      <p className="text-sm font-bold">{slot.title}</p>
      <ul className="flex flex-wrap gap-2" aria-label={`${slot.current} of ${slot.target} found`}>
        {Array.from({ length: slot.target }, (_, i) => {
          const filled = i < slot.current;
          return (
            <li
              key={i}
              data-filled={filled}
              className={`flex size-12 items-center justify-center rounded-full border-4 text-xl font-black ${
                filled
                  ? "cq-pop border-pirate-gold bg-pirate-gold text-pirate-ink"
                  : "border-dashed border-pirate-wood/50 bg-white/40 text-pirate-wood/60"
              }`}
            >
              <span aria-hidden="true">{filled ? "✓" : i + 1}</span>
              <span className="sr-only">{filled ? "Found" : "Not found yet"}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {slot.completed
          ? "You found them all!"
          : `${slot.current} of ${slot.target} found. Finish your chores to find more.`}
      </p>
    </div>
  );
}
