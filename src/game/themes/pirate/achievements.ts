import type { AchievementDefinitionInput } from "@/game/schemas";

export const pirateAchievements: AchievementDefinitionInput[] = [
  {
    key: "pirate.first-chore",
    title: "Deckhand",
    description: "Complete your very first approved chore.",
    iconKey: "achievement.deckhand",
    criteria: { type: "APPROVED_ACTIVITY_COUNT", count: 1 },
    rewardCoins: 10,
    rewardXp: 20,
  },
  {
    key: "pirate.ten-chores",
    title: "Able Seaman",
    description: "Complete ten approved chores.",
    iconKey: "achievement.able-seaman",
    criteria: { type: "APPROVED_ACTIVITY_COUNT", count: 10 },
    rewardCoins: 40,
    rewardXp: 80,
  },
  {
    key: "pirate.first-routine",
    title: "Ship Shape",
    description: "Complete a whole routine.",
    iconKey: "achievement.ship-shape",
    criteria: { type: "ROUTINE_COUNT", count: 1 },
    rewardCoins: 20,
    rewardXp: 40,
  },
  {
    key: "pirate.set-sail",
    title: "Anchors Aweigh",
    description: "Leave Home Port for the first time.",
    iconKey: "achievement.anchors-aweigh",
    criteria: { type: "CHAPTER_COMPLETED", chapterKey: "home-port" },
    rewardCoins: 25,
    rewardXp: 50,
  },
  {
    key: "pirate.compass-found",
    title: "True North",
    description: "Solve the compass puzzle on Parrot Island.",
    iconKey: "achievement.true-north",
    criteria: { type: "PUZZLE_COMPLETED", puzzleKey: "compass-puzzle" },
    rewardCoins: 30,
    rewardXp: 60,
  },
];
