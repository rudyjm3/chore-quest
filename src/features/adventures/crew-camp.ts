/** Pure crew-camp helpers (no I/O). */

/** The slot an item can be worn in (generic item `config.slot`), or null when it is not wearable. */
export function itemSlot(config: unknown): string | null {
  if (config && typeof config === "object" && "slot" in config) {
    const slot = (config as { slot: unknown }).slot;
    if (typeof slot === "string" && slot.length > 0) return slot;
  }
  return null;
}

/** Child-friendly label for a slot key: "head" → "Head". */
export function slotLabel(slot: string): string {
  const words = slot.replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface SceneSlotItem {
  key: string;
  name: string;
  type: string;
  iconKey: string | null;
  equipped: boolean;
}

export interface SceneSlotView {
  slot: string;
  label: string;
  x: number;
  y: number;
  /** What is worn in this slot, or null when it is empty. */
  worn: SceneSlotItem | null;
}

/**
 * Pair the theme's slot anchors with what the child wears (ADR 0018). Slots without an anchor are not
 * drawn (the picker still lists them); anchors without any owned item show as empty spots.
 */
export function buildSceneSlots(
  anchors: Record<string, { x: number; y: number; label: string }>,
  owned: Record<string, SceneSlotItem[]>,
): SceneSlotView[] {
  return Object.entries(anchors).map(([slot, anchor]) => ({
    slot,
    label: anchor.label,
    x: anchor.x,
    y: anchor.y,
    worn: owned[slot]?.find((i) => i.equipped) ?? null,
  }));
}
