import { npcDialogueSchema, type NpcDialogue } from "@/game/schemas";

/** Pip the Parrot's lines. Static text; chosen by situation in `src/game/engine/dialogue.ts`. */
export const pipDialogue: NpcDialogue = npcDialogueSchema.parse({
  npcKey: "pip",
  name: "Pip the Parrot",
  lines: {
    greeting: [
      "Squawk! Welcome back, Captain!",
      "Ahoy! The sea is calm and the ship is shining.",
      "Pip is ready when you are. Where to today?",
    ],
    "quest-complete": [
      "Squawk! You finished a chapter! Go and claim your treasure!",
      "Shiver me feathers, that was brilliant! Your reward is waiting.",
    ],
    "low-supplies": [
      "Pip is peckish. The hold is nearly empty, so finish a chore for more crates!",
      "Our supply crates are running low. Every chore you finish fills the hold.",
    ],
  },
  lowSupplies: { itemKey: "supply-crate", below: 1 },
});
