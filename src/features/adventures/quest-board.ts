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

export interface BoardQuest {
  key: string;
  kind: "MAIN" | "SIDE";
  title: string;
  description: string | null;
  status: string;
  rewards: { coins: number; xp: number; items: Array<{ itemKey: string; quantity: number }> };
  objectives: BoardObjective[];
}

export interface BoardChapter {
  key: string;
  title: string;
  sortOrder: number;
  status: string;
  quests: BoardQuest[];
}

export interface QuestBoardSection {
  chapterKey: string;
  chapterTitle: string;
  quests: BoardQuest[];
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
