import type { AdventureDefinition, AssetManifest } from "@/game/schemas";

import { pirateAdventure, pirateAssetManifest } from "./pirate";

/** Registry of authored adventure themes. The seed writes these to the database. */
export const adventureThemes: Record<
  string,
  { definition: AdventureDefinition; manifest: AssetManifest }
> = {
  pirate: { definition: pirateAdventure, manifest: pirateAssetManifest },
};

export function getAssetManifest(themeKey: string): AssetManifest | undefined {
  return adventureThemes[themeKey]?.manifest;
}
