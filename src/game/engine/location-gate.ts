/**
 * Pure item-hold gates for locations (ADR 0014, 0019). A gate says "the child must currently hold at
 * least N of this item"; it is only ever read, never consumed.
 */
export interface GateLocation {
  key: string;
  puzzleKey?: string | undefined;
  requiresItemKey?: string | undefined;
  requiresItemQuantity?: number | undefined;
}

export interface ItemGate {
  itemKey: string;
  quantity: number;
}

export function locationItemGate(location: GateLocation): ItemGate | null {
  if (!location.requiresItemKey) return null;
  return { itemKey: location.requiresItemKey, quantity: location.requiresItemQuantity ?? 1 };
}

/** The gate on the location(s) that open a puzzle: the strictest one if several exist, else none. */
export function puzzleItemGate(locations: GateLocation[], puzzleKey: string): ItemGate | null {
  let strictest: ItemGate | null = null;
  for (const location of locations) {
    if (location.puzzleKey !== puzzleKey) continue;
    const gate = locationItemGate(location);
    if (gate && (!strictest || gate.quantity > strictest.quantity)) strictest = gate;
  }
  return strictest;
}

export function itemGateMet(gate: ItemGate | null, inventory: Record<string, number>): boolean {
  return !gate || (inventory[gate.itemKey] ?? 0) >= gate.quantity;
}
