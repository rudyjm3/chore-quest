/**
 * Pure item-hold gates for locations (ADR 0014, 0019, 0021). A gate says "the child must currently hold at
 * least N of this item"; a location can have several and is open only while every one holds. Gates are only
 * ever read, never consumed.
 */
export interface GateLocation {
  key: string;
  puzzleKey?: string | undefined;
  requiresItemKey?: string | undefined;
  requiresItemQuantity?: number | undefined;
  requiresItems?: Array<{ itemKey: string; quantity: number }> | undefined;
}

export interface ItemGate {
  itemKey: string;
  quantity: number;
}

/** Merge gates by item, keeping the largest quantity per item, in first-seen order. */
function mergeGates(gates: ItemGate[]): ItemGate[] {
  const byItem = new Map<string, ItemGate>();
  for (const gate of gates) {
    const seen = byItem.get(gate.itemKey);
    if (!seen || gate.quantity > seen.quantity) byItem.set(gate.itemKey, { ...gate });
  }
  return [...byItem.values()];
}

/** Every gate on one location: the single-item pair (default quantity 1) plus `requiresItems`. */
export function locationItemGates(location: GateLocation): ItemGate[] {
  const gates: ItemGate[] = [];
  if (location.requiresItemKey) {
    gates.push({ itemKey: location.requiresItemKey, quantity: location.requiresItemQuantity ?? 1 });
  }
  for (const item of location.requiresItems ?? []) gates.push({ ...item });
  return mergeGates(gates);
}

/** The gates on the location(s) that open a puzzle: every item needed anywhere, the strictest quantity per item. */
export function puzzleItemGates(locations: GateLocation[], puzzleKey: string): ItemGate[] {
  return mergeGates(
    locations.filter((l) => l.puzzleKey === puzzleKey).flatMap((l) => locationItemGates(l)),
  );
}

/** The gates the child does not currently satisfy. */
export function unmetItemGates(gates: ItemGate[], inventory: Record<string, number>): ItemGate[] {
  return gates.filter((gate) => (inventory[gate.itemKey] ?? 0) < gate.quantity);
}

export function itemGatesMet(gates: ItemGate[], inventory: Record<string, number>): boolean {
  return unmetItemGates(gates, inventory).length === 0;
}
