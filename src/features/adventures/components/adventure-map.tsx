import Image from "next/image";

import { MapMarker, type MarkerState } from "@/components/shared/map-marker";
import { getAssetManifest } from "@/game/themes";

export interface MapChapter {
  key: string;
  title: string;
  status: "LOCKED" | "UNLOCKED" | "IN_PROGRESS" | "COMPLETED";
  definitionStatus: "PLAYABLE" | "PLACEHOLDER";
  mapMarker: { x: number; y: number };
  isCurrent: boolean;
}

function markerState(chapter: MapChapter): MarkerState {
  if (chapter.status === "COMPLETED") return "completed";
  if (chapter.status === "LOCKED") return "locked";
  return chapter.isCurrent ? "current" : "unlocked";
}

/**
 * World map: a background image from the asset manifest plus positioned
 * markers. Marker state is data-driven and independent of the artwork.
 */
export function AdventureMap({ themeKey, chapters }: { themeKey: string; chapters: MapChapter[] }) {
  const manifest = getAssetManifest(themeKey);
  const background = manifest?.assets.find((a) => a.id === "map.world");
  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-3xl border-4 border-pirate-wood bg-pirate-sea shadow-xl"
      data-testid="adventure-map"
    >
      {background ? (
        <Image
          src={background.path}
          alt={background.alt}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 1024px"
          className="object-cover"
        />
      ) : null}
      {chapters.map((chapter) => (
        <MapMarker
          key={chapter.key}
          x={chapter.mapMarker.x}
          y={chapter.mapMarker.y}
          label={chapter.title}
          state={markerState(chapter)}
          href={chapter.status === "LOCKED" ? undefined : `/child/adventure/${chapter.key}`}
        />
      ))}
    </div>
  );
}
