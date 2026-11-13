import type { AdventureDefinition, AssetEntry, AssetManifest } from "@/game/schemas";

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

/**
 * Artwork for an item, looked up by its `iconKey` in the theme's manifest. Returns null when the
 * theme has no art for it yet: callers show a neutral placeholder, they never build `/assets/...`
 * paths themselves.
 */
export function getItemAsset(
  themeKey: string | null | undefined,
  iconKey: string | null | undefined,
): AssetEntry | null {
  if (!themeKey || !iconKey) return null;
  return getAssetManifest(themeKey)?.assets.find((a) => a.id === iconKey) ?? null;
}
