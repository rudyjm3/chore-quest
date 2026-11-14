import { z } from "zod";

/**
 * Static, theme-authored NPC dialogue. No free text from users, no external services, no child data:
 * lines are chosen by pure functions (`src/game/engine/dialogue.ts`) over engine state.
 */
export const dialogueSituationSchema = z.enum(["greeting", "quest-complete", "low-supplies"]);
export type DialogueSituation = z.infer<typeof dialogueSituationSchema>;

const lineSchema = z.string().min(1).max(240);

export const npcDialogueSchema = z.object({
  npcKey: z.string(),
  name: z.string(),
  /** Every situation needs at least one line so a selection can never come back empty. */
  lines: z.object({
    greeting: z.array(lineSchema).min(1),
    "quest-complete": z.array(lineSchema).min(1),
    "low-supplies": z.array(lineSchema).min(1),
  }),
  /** `low-supplies` applies while the child holds fewer than `below` of this item. */
  lowSupplies: z.object({ itemKey: z.string(), below: z.number().int().min(1) }),
});
export type NpcDialogue = z.infer<typeof npcDialogueSchema>;
