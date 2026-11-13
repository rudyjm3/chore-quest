import {
  adventureDefinitionSchema,
  type AdventureDefinition,
  type AdventureDefinitionInput,
} from "@/game/schemas";

import { pirateAchievements } from "./achievements";
import { pirateItems } from "./items";

/**
 * Pirate Adventure — The Lost Treasure of Blackbeard Bay
 *
 * All progression numbers (3 crates, 4 feathers, ...) are chapter data here,
 * not rules in services. Chapters 3–6 are placeholders with unlock rules only.
 */
const definition: AdventureDefinitionInput = {
  key: "pirate",
  title: "The Lost Treasure of Blackbeard Bay",
  description:
    "Set sail from Home Port, recover Pip's magic compass, brave Skull Reef and uncover Blackbeard's lost treasure.",
  themeKey: "pirate",
  version: 1,
  config: {
    perActivity: { coins: 5, xp: 10 },
    starterItems: [{ itemKey: "ship-starter", quantity: 1 }],
    levelThresholds: [100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000],
  },
  items: pirateItems,
  achievements: pirateAchievements,
  chapters: [
    {
      key: "home-port",
      sortOrder: 1,
      title: "Home Port",
      subtitle: "Prepare the ship and collect supplies",
      locationName: "Home Port",
      description:
        "The pirate captain needs a crew. Stock the starter ship with supply crates and get ready to sail.",
      status: "PLAYABLE",
      config: {
        unlock: { requires: [{ type: "ALWAYS" }] },
        completion: { requiresQuestKeys: ["prepare-the-ship"] },
        rewards: { coins: 50, xp: 100, items: [{ itemKey: "map-fragment", quantity: 1 }] },
        mapMarker: { x: 14, y: 72 },
        hint: "Collect supply crates by finishing your chores. Three crates and the ship is ready to sail!",
        sceneAssetKey: "scene.home-port",
        locations: [
          {
            key: "captain",
            name: "The Captain",
            kind: "npc",
            position: { x: 30, y: 60 },
            npcKey: "captain",
          },
          { key: "starter-ship", name: "Your Ship", kind: "harbor", position: { x: 70, y: 70 } },
          {
            key: "quest-board",
            name: "Quest Board",
            kind: "quest-board",
            position: { x: 45, y: 45 },
            questKey: "prepare-the-ship",
          },
          { key: "supply-shop", name: "Supply Shop", kind: "shop", position: { x: 20, y: 40 } },
          {
            key: "crew-camp",
            name: "Crew Camp",
            kind: "camp",
            position: { x: 60, y: 30 },
            questKey: "tidy-the-camp",
          },
          { key: "lighthouse", name: "Lighthouse", kind: "landmark", position: { x: 85, y: 20 } },
          {
            key: "hidden-cove",
            name: "Hidden Cove",
            kind: "landmark",
            position: { x: 10, y: 85 },
            description: "Something glints behind the rocks...",
          },
        ],
      },
      quests: [
        {
          key: "prepare-the-ship",
          kind: "MAIN",
          title: "Prepare the Ship",
          description: "Earn three supply crates by completing approved chores, then set sail.",
          rewardCoins: 20,
          rewardXp: 40,
          config: { rewards: { coins: 20, xp: 40, items: [] } },
          objectives: [
            {
              key: "collect-supplies",
              title: "Collect 3 supply crates",
              type: "APPROVED_ACTIVITIES",
              targetCount: 3,
              config: { eligibility: {}, grantItemKey: "supply-crate", grantQuantity: 1 },
            },
          ],
        },
        {
          key: "tidy-the-camp",
          kind: "SIDE",
          title: "Tidy the Crew Camp",
          description: "Complete a full routine to earn a camp reward.",
          rewardCoins: 15,
          rewardXp: 25,
          config: {
            rewards: {
              coins: 15,
              xp: 25,
              items: [{ itemKey: "cosmetic-captain-hat", quantity: 1 }],
            },
          },
          objectives: [
            {
              key: "finish-routine",
              title: "Complete one routine",
              type: "COMPLETE_ROUTINES",
              targetCount: 1,
              config: { eligibility: { sourceTypes: ["ROUTINE_RUN"] } },
            },
          ],
        },
      ],
      puzzles: [],
    },
    {
      key: "parrot-island",
      sortOrder: 2,
      title: "Parrot Island",
      subtitle: "Recover the missing compass",
      locationName: "Parrot Island",
      description:
        "Pip the Parrot has lost the magic compass. Gather four compass feathers and solve the compass puzzle.",
      status: "PLAYABLE",
      config: {
        unlock: {
          requires: [
            { type: "CHAPTER_COMPLETED", chapterKey: "home-port" },
            { type: "ITEM", itemKey: "supply-crate", quantity: 3 },
          ],
        },
        completion: { requiresQuestKeys: ["recover-the-compass"] },
        rewards: { coins: 75, xp: 150, items: [{ itemKey: "map-fragment", quantity: 1 }] },
        mapMarker: { x: 34, y: 52 },
        hint: "Pip loves shiny feathers. Keep helping out and they will turn up one by one.",
        sceneAssetKey: "scene.parrot-island",
        locations: [
          {
            key: "pip",
            name: "Pip the Parrot",
            kind: "npc",
            position: { x: 40, y: 55 },
            npcKey: "pip",
          },
          {
            key: "feather-grove",
            name: "Feather Grove",
            kind: "quest-board",
            position: { x: 25, y: 35 },
            questKey: "recover-the-compass",
          },
          {
            key: "compass-shrine",
            name: "Compass Shrine",
            kind: "puzzle",
            position: { x: 70, y: 40 },
            puzzleKey: "compass-puzzle",
          },
          { key: "beach", name: "Sunny Beach", kind: "decorative", position: { x: 55, y: 80 } },
        ],
      },
      quests: [
        {
          key: "recover-the-compass",
          kind: "MAIN",
          title: "Recover the Compass",
          description:
            "Earn four compass feathers, then solve the shrine puzzle to restore the compass.",
          rewardCoins: 30,
          rewardXp: 60,
          config: {
            rewards: { coins: 30, xp: 60, items: [{ itemKey: "magic-compass", quantity: 1 }] },
          },
          objectives: [
            {
              key: "collect-feathers",
              title: "Collect 4 compass feathers",
              type: "APPROVED_ACTIVITIES",
              targetCount: 4,
              config: { eligibility: {}, grantItemKey: "compass-feather", grantQuantity: 1 },
            },
            {
              key: "solve-compass-puzzle",
              title: "Solve the compass puzzle",
              type: "COMPLETE_PUZZLE",
              targetCount: 1,
              config: {
                eligibility: {},
                puzzleKey: "compass-puzzle",
                requiresObjectiveKey: "collect-feathers",
              },
            },
          ],
        },
      ],
      puzzles: [
        {
          key: "compass-puzzle",
          title: "The Compass Shrine",
          type: "sequence-match",
          config: {
            rewards: { coins: 10, xp: 20, items: [] },
            data: {
              symbols: ["N", "E", "S", "W"],
              sequence: ["N", "E", "S", "W"],
              hint: "Pip squawks: start at the top and follow the sun!",
            },
          },
        },
      ],
    },
    {
      key: "shipwreck-cove",
      sortOrder: 3,
      title: "Shipwreck Cove",
      subtitle: "Collect salvage and repair a damaged ship",
      locationName: "Shipwreck Cove",
      status: "PLACEHOLDER",
      config: {
        unlock: { requires: [{ type: "CHAPTER_COMPLETED", chapterKey: "parrot-island" }] },
        completion: { requiresQuestKeys: [] },
        rewards: { coins: 100, xp: 200, items: [{ itemKey: "map-fragment", quantity: 1 }] },
        mapMarker: { x: 52, y: 66 },
        hint: "The cove is far away. A sturdier ship will get you there.",
        sceneAssetKey: "scene.shipwreck-cove",
        locations: [],
      },
      quests: [],
      puzzles: [],
    },
    {
      key: "skull-reef",
      sortOrder: 4,
      title: "Skull Reef",
      subtitle: "Navigate dangerous waters and overcome the Kraken",
      locationName: "Skull Reef",
      status: "PLACEHOLDER",
      config: {
        unlock: { requires: [{ type: "CHAPTER_COMPLETED", chapterKey: "shipwreck-cove" }] },
        completion: { requiresQuestKeys: [] },
        rewards: { coins: 125, xp: 250, items: [{ itemKey: "map-fragment", quantity: 1 }] },
        mapMarker: { x: 66, y: 40 },
        hint: "Something spooky lies beyond the fog. Finish the cove first.",
        sceneAssetKey: "scene.skull-reef",
        locations: [],
      },
      quests: [],
      puzzles: [],
    },
    {
      key: "whispering-jungle",
      sortOrder: 5,
      title: "Whispering Jungle",
      subtitle: "Discover ancient clues and artifacts",
      locationName: "Whispering Jungle",
      status: "PLACEHOLDER",
      config: {
        unlock: { requires: [{ type: "CHAPTER_COMPLETED", chapterKey: "skull-reef" }] },
        completion: { requiresQuestKeys: [] },
        rewards: { coins: 150, xp: 300, items: [{ itemKey: "map-fragment", quantity: 1 }] },
        mapMarker: { x: 80, y: 58 },
        hint: "The jungle whispers to brave sailors who finish the reef.",
        sceneAssetKey: "scene.whispering-jungle",
        locations: [],
      },
      quests: [],
      puzzles: [],
    },
    {
      key: "treasure-island",
      sortOrder: 6,
      title: "Treasure Island",
      subtitle: "Unlock the final treasure",
      locationName: "Treasure Island",
      status: "PLACEHOLDER",
      config: {
        unlock: {
          requires: [
            { type: "CHAPTER_COMPLETED", chapterKey: "whispering-jungle" },
            { type: "ITEM", itemKey: "map-fragment", quantity: 5 },
          ],
        },
        completion: { requiresQuestKeys: [] },
        rewards: { coins: 500, xp: 1000, items: [{ itemKey: "map-fragment", quantity: 1 }] },
        mapMarker: { x: 90, y: 24 },
        hint: "All the map pieces together point to the treasure. Keep collecting!",
        sceneAssetKey: "scene.treasure-island",
        locations: [],
      },
      quests: [],
      puzzles: [],
    },
  ],
};

export const pirateAdventure: AdventureDefinition = adventureDefinitionSchema.parse(definition);
