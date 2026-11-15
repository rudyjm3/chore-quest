import { locationHasPage, type LocationChapter } from "./location-view";

/**
 * Pure quest-board selection (no I/O). The board shows only what the engine already computed in
 * `getAdventureState`: active quests of chapters the child can currently play.
 */
export interface BoardObjective {
  key: string;
  title: string;
  currentCount: number;
  targetCount: number;
  completed: boolean;
}

/** The place a quest belongs to, from the chapter's authored `locations[].questKey`. */
export interface QuestLocation {
  key: string;
  name: string;
  /** Link to the location page, only when that location has one (ADR 0015); otherwise null. */
  href: string | null;
}

export interface BoardQuest {
  key: string;
  kind: "MAIN" | "SIDE";
  title: string;
  description: string | null;
  status: string;
  rewards: { coins: number; xp: number; items: Array<{ itemKey: string; quantity: number }> };
  objectives: BoardObjective[];
  location: QuestLocation | null;
}

export interface BoardChapter {
  key: string;
  title: string;
  sortOrder: number;
  status: string;
  quests: Array<Omit<BoardQuest, "location">>;
  locations?: LocationChapter["locations"];
}

export interface QuestBoardSection {
  chapterKey: string;
  chapterTitle: string;
  quests: BoardQuest[];
}

/** Which location of this chapter a quest belongs to (first location naming it), or null. */
export function findQuestLocation(
  chapterKey: string,
  locations: LocationChapter["locations"],
  questKey: string,
): QuestLocation | null {
  const location = locations.find((l) => l.questKey === questKey);
  if (!location) return null;
  return {
    key: location.key,
    name: location.name,
    href: locationHasPage(location) ? `/child/adventure/${chapterKey}/${location.key}` : null,
  };
}

/**
 * Reached chapters (anything but LOCKED, completed ones included: finishing the main quest does not
 * close optional quests, and the engine keeps feeding them) with their ACTIVE quests, main first.
 */
export function buildQuestBoard(chapters: BoardChapter[]): QuestBoardSection[] {
  return chapters
    .filter((c) => c.status !== "LOCKED")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      chapterKey: c.key,
      chapterTitle: c.title,
      quests: c.quests
        .filter((q) => q.status === "ACTIVE")
        .map((q) => ({ ...q, location: findQuestLocation(c.key, c.locations ?? [], q.key) }))
        .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "MAIN" ? -1 : 1)),
    }))
    .filter((section) => section.quests.length > 0);
}

/** "🪙 20 · ✨ 50 XP · 1× map fragment" — empty string when the quest pays nothing. */
export function describeReward(rewards: BoardQuest["rewards"]): string {
  const parts: string[] = [];
  if (rewards.coins > 0) parts.push(`🪙 ${rewards.coins}`);
  if (rewards.xp > 0) parts.push(`✨ ${rewards.xp} XP`);
  for (const item of rewards.items) {
    parts.push(`${item.quantity}× ${item.itemKey.replaceAll("-", " ")}`);
  }
  return parts.join(" · ");
}
