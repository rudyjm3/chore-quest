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
