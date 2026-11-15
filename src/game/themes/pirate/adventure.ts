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
            requiresItemKey: "map-fragment",
            reward: { itemKey: "cove-pearl", quantity: 1 },
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
      description:
        "An old ship lies wrecked in the cove. Haul salvage out of the wreck by finishing chores, then match every damaged part to the right tool.",
      status: "PLAYABLE",
      config: {
        unlock: {
          requires: [
            { type: "CHAPTER_COMPLETED", chapterKey: "parrot-island" },
            { type: "ITEM", itemKey: "ship-explorer", quantity: 1 },
          ],
        },
        completion: { requiresQuestKeys: ["salvage-the-wreck"] },
        rewards: { coins: 100, xp: 200, items: [{ itemKey: "map-fragment", quantity: 1 }] },
        mapMarker: { x: 52, y: 66 },
        hint: "A wrecked ship waits in the cove. Sail there in the Explorer Ship, then earn salvage by finishing chores.",
        sceneAssetKey: "scene.shipwreck-cove",
        locations: [
          {
            key: "salvage-yard",
            name: "Salvage Yard",
            kind: "quest-board",
            position: { x: 25, y: 60 },
            questKey: "salvage-the-wreck",
            description: "Planks and rope wash up here. Every finished chore brings more.",
          },
          {
            key: "tide-pools",
            name: "Tide Pools",
            kind: "quest-board",
            position: { x: 15, y: 35 },
            questKey: "tide-pool-treasures",
          },
          {
            key: "the-wreck",
            name: "The Wreck",
            kind: "puzzle",
            position: { x: 68, y: 50 },
            puzzleKey: "repair-puzzle",
            description: "You need four salvage planks in your hold to start the repairs.",
            requiresItemKey: "salvage-plank",
            requiresItemQuantity: 4,
          },
          { key: "lagoon", name: "Quiet Lagoon", kind: "decorative", position: { x: 50, y: 82 } },
        ],
      },
      quests: [
        {
          key: "salvage-the-wreck",
          kind: "MAIN",
          title: "Salvage the Wreck",
          description:
            "Gather planks and rope from the wreck, then repair the ship. Planks come first from any approved chore; once you have enough, the next chores become rope.",
          rewardCoins: 50,
          rewardXp: 100,
          config: { rewards: { coins: 50, xp: 100, items: [] } },
          objectives: [
            {
              key: "gather-planks",
              title: "Gather 4 salvage planks",
              type: "APPROVED_ACTIVITIES",
              targetCount: 4,
              config: { eligibility: {}, grantItemKey: "salvage-plank", grantQuantity: 1 },
            },
            {
              key: "gather-rope",
              title: "Gather 3 coils of rope",
              type: "APPROVED_ACTIVITIES",
              targetCount: 3,
              config: {
                // Any category: planks come first (first matching objective), so rope can never dead-end.
                eligibility: {},
                grantItemKey: "rope-coil",
                grantQuantity: 1,
              },
            },
            {
              key: "repair-the-ship",
              title: "Repair the ship",
              type: "COMPLETE_PUZZLE",
              targetCount: 1,
              config: { eligibility: {}, puzzleKey: "repair-puzzle" },
            },
          ],
        },
        {
          key: "tide-pool-treasures",
          kind: "SIDE",
          title: "Tide Pool Treasures",
          description: "Help out around the house or look after a pet to find what the tide left.",
          rewardCoins: 15,
          rewardXp: 25,
          config: { rewards: { coins: 15, xp: 25, items: [] } },
          objectives: [
            {
              key: "search-the-pools",
              title: "Help out or care for a pet twice",
              type: "APPROVED_ACTIVITIES",
              targetCount: 2,
              config: { eligibility: { categories: ["HELPING", "PET_CARE"] } },
            },
          ],
        },
      ],
      puzzles: [
        {
          key: "repair-puzzle",
          title: "Repair the Ship",
          type: "pair-match",
          config: {
            rewards: { coins: 25, xp: 50, items: [] },
            data: {
              parts: [
                { key: "hull", label: "Leaky hull" },
                { key: "mast", label: "Cracked mast" },
                { key: "sail", label: "Torn sail" },
                { key: "wheel", label: "Stuck wheel" },
                { key: "anchor", label: "Rusty anchor" },
              ],
              tools: [
                { key: "hammer", label: "Hammer and nails" },
                { key: "needle", label: "Needle and thread" },
                { key: "oil", label: "Oil can" },
                { key: "saw", label: "Saw" },
                { key: "wrench", label: "Wrench" },
              ],
              pairs: {
                hull: "hammer",
                sail: "needle",
                anchor: "oil",
                mast: "saw",
                wheel: "wrench",
              },
              hint: "Pip squawks: think about what each broken thing needs to work again!",
            },
          },
        },
      ],
    },
    {
      key: "skull-reef",
      sortOrder: 4,
      title: "Skull Reef",
      subtitle: "Navigate dangerous waters and overcome the Kraken",
      locationName: "Skull Reef",
      description:
        "Jagged rocks and a hungry Kraken guard the reef. Piece a sea chart together by finishing chores, plot a safe route through the rocks, then outwit the Kraken in three steps.",
      status: "PLAYABLE",
      config: {
        unlock: {
          requires: [
            { type: "CHAPTER_COMPLETED", chapterKey: "shipwreck-cove" },
            { type: "ITEM", itemKey: "ship-voyager", quantity: 1 },
          ],
        },
        completion: { requiresQuestKeys: ["navigate-the-reef", "defeat-the-kraken"] },
        rewards: { coins: 125, xp: 250, items: [{ itemKey: "map-fragment", quantity: 1 }] },
        mapMarker: { x: 66, y: 40 },
        hint: "Something spooky lies beyond the fog. Finish the cove, then sail there in the Voyager Ship from the supply shop.",
        sceneAssetKey: "scene.skull-reef",
        locations: [
          {
            key: "reef-board",
            name: "Quest Board",
            kind: "quest-board",
            position: { x: 20, y: 70 },
            questKey: "navigate-the-reef",
            description: "Chart pieces drift in with the tide. Every finished chore brings one.",
          },
          {
            key: "chart-table",
            name: "Reef Chart Table",
            kind: "puzzle",
            position: { x: 38, y: 55 },
            puzzleKey: "reef-chart-puzzle",
            description:
              "You need five chart pieces in your hold to plan a route through the rocks.",
            requiresItemKey: "chart-piece",
            requiresItemQuantity: 5,
          },
          {
            key: "kraken-watch",
            name: "Kraken Watch",
            kind: "quest-board",
            position: { x: 72, y: 78 },
            questKey: "defeat-the-kraken",
            description: "Three steps to outwit the Kraken. Chart the reef first.",
          },
          {
            key: "tentacle-rocks",
            name: "Tentacle Rocks",
            kind: "puzzle",
            position: { x: 60, y: 30 },
            puzzleKey: "kraken-tentacles",
            description: "Step one: learn how the Kraken's tentacles move.",
          },
          {
            key: "krakens-lair",
            name: "Kraken's Lair",
            kind: "puzzle",
            position: { x: 80, y: 45 },
            puzzleKey: "kraken-weak-points",
            description: "Step two: find what stops each part of the Kraken.",
          },
          {
            key: "whirlpool-gate",
            name: "Whirlpool Gate",
            kind: "puzzle",
            position: { x: 48, y: 20 },
            puzzleKey: "kraken-escape",
            description: "Step three: steer the ship clear of the rocks and away.",
          },
          {
            key: "coral-shallows",
            name: "Coral Shallows",
            kind: "quest-board",
            position: { x: 12, y: 40 },
            questKey: "reef-scavengers",
          },
          { key: "bone-wreck", name: "Bone Wreck", kind: "decorative", position: { x: 88, y: 80 } },
        ],
      },
      quests: [
        {
          key: "navigate-the-reef",
          kind: "MAIN",
          title: "Navigate the Reef",
          description:
            "Collect five pieces of sea chart from approved chores, then plan a safe route through the rocks.",
          rewardCoins: 40,
          rewardXp: 80,
          config: { rewards: { coins: 40, xp: 80, items: [] } },
          objectives: [
            {
              key: "collect-chart-pieces",
              title: "Collect 5 chart pieces",
              type: "APPROVED_ACTIVITIES",
              targetCount: 5,
              config: { eligibility: {}, grantItemKey: "chart-piece", grantQuantity: 1 },
            },
            {
              key: "chart-the-course",
              title: "Plan a safe route through the reef",
              type: "COMPLETE_PUZZLE",
              targetCount: 1,
              // No `requiresObjectiveKey`: the chart table's item gate (5 pieces held) is the ordering, as at the wreck.
              config: { eligibility: {}, puzzleKey: "reef-chart-puzzle" },
            },
          ],
        },
        {
          key: "defeat-the-kraken",
          kind: "MAIN",
          title: "Defeat the Kraken",
          description:
            "The Kraken guards the way through. Outwit it in three steps, one after the other.",
          rewardCoins: 60,
          rewardXp: 120,
          config: {
            rewards: { coins: 60, xp: 120, items: [{ itemKey: "kraken-tooth", quantity: 1 }] },
            requiresQuestKey: "navigate-the-reef",
          },
          objectives: [
            {
              key: "read-the-tentacles",
              title: "Learn the Kraken's tentacle pattern",
              type: "COMPLETE_PUZZLE",
              targetCount: 1,
              config: { eligibility: {}, puzzleKey: "kraken-tentacles" },
            },
            {
              key: "find-the-weak-points",
              title: "Match each part of the Kraken to what stops it",
              type: "COMPLETE_PUZZLE",
              targetCount: 1,
              config: {
                eligibility: {},
                puzzleKey: "kraken-weak-points",
                requiresObjectiveKey: "read-the-tentacles",
              },
            },
            {
              key: "steer-to-safety",
              title: "Steer the ship to safety",
              type: "COMPLETE_PUZZLE",
              targetCount: 1,
              config: {
                eligibility: {},
                puzzleKey: "kraken-escape",
                requiresObjectiveKey: "find-the-weak-points",
              },
            },
          ],
        },
        {
          key: "reef-scavengers",
          kind: "SIDE",
          title: "Reef Scavengers",
          description: "Keep the crew sharp: finish two hygiene or school chores.",
          rewardCoins: 20,
          rewardXp: 30,
          config: { rewards: { coins: 20, xp: 30, items: [] } },
          objectives: [
            {
              key: "scavenge-the-shallows",
              title: "Finish two hygiene or school chores",
              type: "APPROVED_ACTIVITIES",
              targetCount: 2,
              config: { eligibility: { categories: ["HYGIENE", "SCHOOL"] } },
            },
          ],
        },
      ],
      puzzles: [
        {
          key: "reef-chart-puzzle",
          title: "The Reef Chart",
          type: "route-plan",
          config: {
            rewards: { coins: 20, xp: 40, items: [] },
            data: {
              width: 5,
              height: 5,
              start: { x: 0, y: 4 },
              goal: { x: 4, y: 0 },
              reefs: [
                { x: 2, y: 4 },
                { x: 0, y: 2 },
                { x: 1, y: 1 },
                { x: 3, y: 1 },
                { x: 3, y: 3 },
              ],
              hint: "The straight way is blocked. Find a gap between the rocks!",
            },
          },
        },
        {
          key: "kraken-tentacles",
          title: "The Tentacle Pattern",
          type: "sequence-match",
          config: {
            rewards: { coins: 10, xp: 20, items: [] },
            data: {
              symbols: ["Coil", "Slam", "Sweep", "Snap"],
              sequence: ["Coil", "Sweep", "Slam", "Sweep", "Snap"],
              hint: "Pip squawks: the Kraken always starts by coiling up!",
            },
          },
        },
        {
          key: "kraken-weak-points",
          title: "The Kraken's Weak Points",
          type: "pair-match",
          config: {
            rewards: { coins: 15, xp: 30, items: [] },
            data: {
              parts: [
                { key: "tentacle", label: "Slippery tentacle" },
                { key: "beak", label: "Snapping beak" },
                { key: "eye", label: "Glowing eye" },
                { key: "ink", label: "Inky cloud" },
                { key: "grip", label: "Crushing grip" },
              ],
              tools: [
                { key: "net", label: "Rough net" },
                { key: "shield", label: "Iron shield" },
                { key: "glass", label: "Smoked glass" },
                { key: "lantern", label: "Bright lantern" },
                { key: "hook", label: "Cutting hook" },
              ],
              pairs: {
                tentacle: "net",
                beak: "shield",
                eye: "glass",
                ink: "lantern",
                grip: "hook",
              },
              hint: "Think about what would stop each part of the Kraken.",
            },
          },
        },
        {
          key: "kraken-escape",
          title: "The Whirlpool Escape",
          type: "route-plan",
          config: {
            rewards: { coins: 20, xp: 40, items: [] },
            data: {
              width: 6,
              height: 6,
              start: { x: 0, y: 5 },
              goal: { x: 5, y: 0 },
              reefs: [
                { x: 1, y: 1 },
                { x: 3, y: 1 },
                { x: 4, y: 1 },
                { x: 0, y: 3 },
                { x: 2, y: 3 },
                { x: 4, y: 3 },
                { x: 3, y: 4 },
                { x: 2, y: 5 },
              ],
              hint: "Row three is clear of rocks. Can you reach it?",
            },
          },
        },
      ],
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
