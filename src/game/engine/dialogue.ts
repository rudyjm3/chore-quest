import type { DialogueSituation, NpcDialogue } from "../schemas/dialogue";

/** Pure dialogue selection (no I/O, no randomness): the same state and day always give the same line. */
export interface DialogueInput {
  started: boolean;
  /** A completed chapter whose reward the child has not claimed yet. */
  hasUnclaimedChapterReward: boolean;
  /** itemKey → quantity owned. */
  inventory: Record<string, number>;
}

export function selectSituation(input: DialogueInput, npc: NpcDialogue): DialogueSituation {
  if (!input.started) return "greeting";
  if (input.hasUnclaimedChapterReward) return "quest-complete";
  if ((input.inventory[npc.lowSupplies.itemKey] ?? 0) < npc.lowSupplies.below) {
    return "low-supplies";
  }
  return "greeting";
}

/** Stable string hash → non-negative integer (FNV-1a). */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Pick one line for the situation; `seed` (e.g. the local date) rotates the line day by day. */
export function selectLine(npc: NpcDialogue, input: DialogueInput, seed: string) {
  const situation = selectSituation(input, npc);
  const lines = npc.lines[situation];
  const line = lines[hash(`${npc.npcKey}:${situation}:${seed}`) % lines.length] ?? lines[0];
  return { situation, line: line ?? "" };
}
