import { z } from "zod";

import { positionSchema } from "./chapter-config";

/**
 * Asset manifests describe artwork independently of gameplay logic, so any
 * illustration can be replaced without touching services or chapter rules.
 */
export const assetTypeSchema = z.enum([
  "background",
  "scene",
  "marker",
  "character",
  "ship",
  "collectible",
  "ui",
  "icon",
]);

export const assetAnimationSchema = z.object({
  kind: z.enum(["none", "bob", "pulse", "sway", "sprite"]).default("none"),
  durationMs: z.number().int().min(100).max(60_000).optional(),
  frames: z.number().int().min(1).optional(),
});

export const assetEntrySchema = z.object({
  id: z.string(),
  path: z.string().startsWith("/assets/"),
  type: assetTypeSchema,
  theme: z.string(),
  chapterKey: z.string().optional(),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  position: positionSchema.optional(),
  animation: assetAnimationSchema.optional(),
  alt: z.string().default(""),
  /** Prototype/reference artwork that must be replaced before launch. */
  placeholder: z.boolean().default(false),
});
export type AssetEntry = z.infer<typeof assetEntrySchema>;

export const assetManifestSchema = z.object({
  theme: z.string(),
  version: z.number().int().min(1),
  assets: z.array(assetEntrySchema),
});
export type AssetManifest = z.infer<typeof assetManifestSchema>;
