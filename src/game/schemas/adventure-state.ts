import { z } from "zod";

/**
 * Small persisted game state stored in `child_adventure_progress.state`. Never authoritative for
 * rewards, unlocks or progress: those come from ActivityCompletion-driven engine rows and ledgers.
 * Theme-neutral: slot and item keys are plain strings that item data (`config.slot`) defines.
 * Unknown keys are kept so later flags can share the object.
 */
const slotKeySchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-z][a-z0-9-]*$/);
const itemKeySchema = z.string().min(1).max(64);

export const adventureStateSchema = z.looseObject({
  equipped: z.record(slotKeySchema, itemKeySchema).default({}),
});
export type AdventureState = z.infer<typeof adventureStateSchema>;

/** Tolerant read: stored JSON that does not parse is treated as an empty state, never an error. */
export function parseAdventureState(raw: unknown): AdventureState {
  const parsed = adventureStateSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : { equipped: {} };
}

export const equipSlotSchema = slotKeySchema;
export const equipItemKeySchema = itemKeySchema;
