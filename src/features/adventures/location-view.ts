/**
 * Pure location-page selection (no I/O, ADR 0015). Works on the shapes `getAdventureState` already
 * returns, so a location page shows only what the engine computed for the signed-in child.
 */
export interface LocationObjective {
  key: string;
  title: string;
  type: string;
  currentCount: number;
  targetCount: number;
  completed: boolean;
  puzzleKey: string | null;
  available: boolean;
}

export interface LocationQuest {
  key: string;
  kind: "MAIN" | "SIDE";
  title: string;
  description: string | null;
  status: string;
  rewards: { coins: number; xp: number; items: Array<{ itemKey: string; quantity: number }> };
  objectives: LocationObjective[];
}

export interface LocationChapter {
  quests: LocationQuest[];
  locations: Array<{
    key: string;
    name: string;
    kind: string;
    description?: string | undefined;
    questKey?: string | undefined;
    puzzleKey?: string | undefined;
  }>;
}

export interface CollectionSlot {
  key: string;
  title: string;
  current: number;
  target: number;
  completed: boolean;
}

export type LocationView =
  | {
      kind: "quest-board";
      name: string;
      description: string | null;
      quest: LocationQuest;
      /** Count-style objectives (e.g. "collect 4 feathers") as progress slots. */
      collections: CollectionSlot[];
    }
  | {
      kind: "puzzle";
      name: string;
      description: string | null;
      puzzleKey: string;
      /** False while an earlier objective of the quest is unfinished. */
      available: boolean;
      /** Title of the objective to finish first, when not available. */
      waitingFor: string | null;
      /** Null when no quest uses the puzzle, so the page falls back to the puzzle's own record. */
      solved: boolean | null;
    };

const COUNT_OBJECTIVES = new Set(["APPROVED_ACTIVITIES", "COMPLETE_ROUTINES", "COLLECT_ITEMS"]);

/** Does this location open a page of its own? Used to decide which scene labels become links. */
export function locationHasPage(location: LocationChapter["locations"][number]): boolean {
  return (
    (location.kind === "quest-board" && Boolean(location.questKey)) ||
    (location.kind === "puzzle" && Boolean(location.puzzleKey))
  );
}

export function buildLocationView(
  chapter: LocationChapter,
  locationKey: string,
): LocationView | null {
  const location = chapter.locations.find((l) => l.key === locationKey);
  if (!location || !locationHasPage(location)) return null;

  if (location.kind === "quest-board") {
    const quest = chapter.quests.find((q) => q.key === location.questKey);
    if (!quest) return null;
    return {
      kind: "quest-board",
      name: location.name,
      description: location.description ?? null,
      quest,
      collections: quest.objectives
        .filter((o) => COUNT_OBJECTIVES.has(o.type) && o.targetCount > 1)
        .map((o) => ({
          key: o.key,
          title: o.title,
          current: Math.min(o.currentCount, o.targetCount),
          target: o.targetCount,
          completed: o.completed,
        })),
    };
  }

  const puzzleKey = location.puzzleKey as string; // locationHasPage guarantees it for puzzle locations
  for (const quest of chapter.quests) {
    const objective = quest.objectives.find(
      (o) => o.type === "COMPLETE_PUZZLE" && o.puzzleKey === puzzleKey,
    );
    if (!objective) continue;
    const waiting = objective.available
      ? null
      : (quest.objectives.find((o) => o.key !== objective.key && !o.completed)?.title ?? null);
    return {
      kind: "puzzle",
      name: location.name,
      description: location.description ?? null,
      puzzleKey,
      available: objective.available,
      waitingFor: waiting,
      solved: objective.completed,
    };
  }
  return {
    kind: "puzzle",
    name: location.name,
    description: location.description ?? null,
    puzzleKey,
    available: true,
    waitingFor: null,
    solved: null,
  };
}
