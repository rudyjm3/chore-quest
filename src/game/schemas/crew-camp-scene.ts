import { z } from "zod";

import { positionSchema } from "./chapter-config";

/**
 * How a theme dresses the crew-camp ship (ADR 0018): which manifest asset is the ship and where each
 * wearable slot sits on it (percent of the scene, like map markers). Theme data only; the scene
 * component is theme-neutral and ignores slots without an anchor.
 */
export const crewCampSceneSchema = z.object({
  /** Manifest asset id of the ship picture. */
  shipAssetId: z.string(),
  slots: z.record(z.string(), positionSchema.extend({ label: z.string() })),
});
export type CrewCampScene = z.infer<typeof crewCampSceneSchema>;
