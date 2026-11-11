import type { ActivitySourceType, ObjectiveType, TaskCategory } from "@/generated/prisma/enums";

import { objectiveConfigSchema, type ObjectiveConfig } from "../schemas/chapter-config";

export interface ObjectiveFacts {
  sourceType: ActivitySourceType;
  taskCategory: TaskCategory | null;
}

export function parseObjectiveConfig(raw: unknown): ObjectiveConfig {
  return objectiveConfigSchema.parse(raw);
}

/** Can a verified completion contribute to an objective of this type/config? */
export function completionMatchesObjective(
  type: ObjectiveType,
  config: ObjectiveConfig,
  facts: ObjectiveFacts,
): boolean {
  if (type === "APPROVED_ACTIVITIES") {
    const sources = config.eligibility.sourceTypes;
    if (sources && !sources.includes(facts.sourceType)) return false;
    const categories = config.eligibility.categories;
    if (categories && (!facts.taskCategory || !categories.includes(facts.taskCategory)))
      return false;
    return true;
  }
  if (type === "COMPLETE_ROUTINES") {
    return facts.sourceType === "ROUTINE_RUN";
  }
  return false;
}

export interface ObjectiveCounter {
  currentCount: number;
  targetCount: number;
}

/** Advance a counter by `amount`, clamped to target. Returns the applied delta. */
export function advanceObjective(
  counter: ObjectiveCounter,
  amount = 1,
): { next: number; applied: number } {
  const next = Math.min(counter.targetCount, counter.currentCount + amount);
  return { next, applied: next - counter.currentCount };
}

export function isObjectiveComplete(counter: ObjectiveCounter): boolean {
  return counter.currentCount >= counter.targetCount;
}
