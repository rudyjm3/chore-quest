/**
 * Human-readable one-line summaries for audit log rows. Pure: no I/O.
 *
 * Raw metadata JSON is never shown to users. Each known action has a template that reads only
 * the fields it expects (strings and numbers, trimmed); anything unknown falls back to the
 * humanised action key. Free text a person typed (titles, notes) is rendered as plain text by
 * React, never as HTML.
 */

type Meta = Record<string, unknown> | null | undefined;

function str(meta: Meta, key: string): string | null {
  const value = meta?.[key];
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : null;
}
function num(meta: Meta, key: string): number | null {
  const value = meta?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function quoted(meta: Meta, key: string): string {
  const value = str(meta, key);
  return value ? ` “${value}”` : "";
}
function points(meta: Meta, key = "costPoints"): string {
  const value = num(meta, key);
  return value === null ? "" : ` (${value} points)`;
}
function note(meta: Meta): string {
  const value = str(meta, "note");
  return value ? ` — note: ${value}` : "";
}

const TEMPLATES: Record<string, (m: Meta) => string> = {
  "family.create": () => "Created the family",
  "family.settings.update": () => "Changed family settings",
  "family.code.rotate": () => "Changed the family sign-in code",
  "family.member.add": () => "Added a parent to the family",
  "family.member.remove": () => "Removed a parent from the family",
  "family.invitation.create": () => "Invited a guardian",
  "family.invitation.revoke": () => "Cancelled a guardian invitation",
  "family.invitation.accept": () => "A guardian accepted an invitation",
  "child.create": () => "Added a child profile",
  "child.update": () => "Edited a child profile",
  "child.archive": () => "Archived a child profile",
  "child.restore": () => "Restored a child profile",
  "child.pin.set": () => "Set a new PIN for a child",
  "child.session.start": () => "Child signed in",
  "task.create": () => "Created a task",
  "task.update": () => "Edited a task",
  "task.assign": () => "Assigned a task",
  "task.assignment.update": () => "Changed a task assignment",
  "task.assignment.paused": () => "Paused a task assignment",
  "task.assignment.active": () => "Resumed a task assignment",
  "task.assignment.archived": () => "Archived a task assignment",
  "routine.create": () => "Created a routine",
  "approval.approve": (m) => `Approved a chore${points(m, "points")}${note(m)}`,
  "approval.auto": (m) => `Chore approved automatically${points(m, "points")}`,
  "approval.reject": (m) => `Sent a chore back to try again${note(m)}`,
  "approval.routine.approve": () => "Approved a routine",
  "approval.routine.auto": () => "Routine approved automatically",
  "approval.routine.reject": (m) => `Sent a routine back to try again${note(m)}`,
  "goal.create": () => "Created a goal",
  "goal.update": (m) => {
    const target = num(m, "targetCount");
    const before = num(m, "previousTargetCount");
    const change =
      target !== null && before !== null && target !== before
        ? ` (target ${before} → ${target})`
        : "";
    return `Edited goal${quoted(m, "title")}${change}`;
  },
  "goal.archive": (m) => `Archived goal${quoted(m, "title")}`,
  "goal.restore": (m) => `Restored goal${quoted(m, "title")}`,
  "goal.assignment.update": (m) => `Changed a goal assignment${quoted(m, "goal")}`,
  "goal.repair": (m) => {
    const count = num(m, "assignmentsRepaired");
    return `Recalculated goal progress${quoted(m, "title")}${count !== null ? ` (${count} fixed)` : ""}`;
  },
  "reward.adjust": (m) => {
    const amount = num(m, "amount");
    const currency = str(m, "currency")?.toLowerCase() ?? "points";
    const reason = str(m, "reason");
    const sign = amount !== null && amount > 0 ? "+" : "";
    return `Adjusted ${currency}${amount !== null ? ` by ${sign}${amount}` : ""}${reason ? ` — ${reason}` : ""}`;
  },
  "reward.create": (m) => `Added reward${quoted(m, "title")}${points(m)}`,
  "reward.update": (m) => `Edited reward${quoted(m, "title")}${points(m)}`,
  "reward.archive": (m) => `Archived reward${quoted(m, "title")}`,
  "reward.restore": (m) => `Restored reward${quoted(m, "title")}`,
  "reward.redemption.request": (m) => `Child asked for reward${quoted(m, "title")}${points(m)}`,
  "reward.redemption.approve": (m) => `Approved reward${quoted(m, "title")}${note(m)}`,
  "reward.redemption.deny": (m) =>
    `Declined reward${quoted(m, "title")}, points refunded${note(m)}`,
  "reward.redemption.fulfill": (m) => `Marked reward${quoted(m, "title")} as given`,
};

/** Top-level groups parents can filter by (action prefixes). */
export const AUDIT_FILTERS = [
  { prefix: "approval", label: "Approvals" },
  { prefix: "reward", label: "Rewards" },
  { prefix: "goal", label: "Goals" },
  { prefix: "task", label: "Tasks" },
  { prefix: "routine", label: "Routines" },
  { prefix: "child", label: "Children" },
  { prefix: "family", label: "Family and members" },
] as const;

function humanise(action: string): string {
  const text = action.replaceAll(".", " ").replaceAll("_", " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function summarizeAudit(action: string, metadata: Meta): string {
  const template = TEMPLATES[action];
  return template ? template(metadata) : humanise(action);
}

/** A prefix filter is a dotted-key prefix: lower-case letters, dots and dashes only. */
export function isValidActionPrefix(prefix: string): boolean {
  return /^[a-z][a-z.-]{0,40}$/.test(prefix);
}
