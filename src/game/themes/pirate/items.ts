import type { ItemDefinitionInput } from "@/game/schemas";

/**
 * Pirate Adventure item catalogue. Keys are stable identifiers referenced by
 * chapter configs, quest objectives and the asset manifest. Never rename a key
 * once shipped; add a new one instead.
 */
export const pirateItems: ItemDefinitionInput[] = [
  // --- Resources (earned per approved chore) ---
  {
    key: "supply-crate",
    name: "Supply Crate",
    description: "Provisions for the voyage. Collect three to set sail from Home Port.",
    type: "RESOURCE",
    iconKey: "item.supply-crate",
    config: { chapterKey: "home-port" },
  },
  {
    key: "compass-feather",
    name: "Compass Feather",
    description:
      "A shimmering feather from Pip the Parrot. Four of them reveal the compass puzzle.",
    type: "RESOURCE",
    iconKey: "item.compass-feather",
    config: { chapterKey: "parrot-island" },
  },
  {
    key: "gold-doubloon",
    name: "Gold Doubloon",
    description:
      "A shiny coin for the supply shop. (Display item; balances live in the COINS wallet.)",
    type: "COLLECTIBLE",
    iconKey: "item.gold-doubloon",
    config: { displayOnly: true },
  },
  // --- Collectibles ---
  {
    key: "map-fragment",
    name: "Treasure Map Fragment",
    description:
      "One of six torn pieces of Blackbeard's map. Collect all six to find the treasure.",
    type: "COLLECTIBLE",
    rarity: "RARE",
    iconKey: "item.map-fragment",
    maxQuantity: 6,
    config: { totalFragments: 6 },
  },
  {
    key: "magic-compass",
    name: "Magic Compass",
    description: "Pip's lost compass, restored. It always points toward adventure.",
    type: "COLLECTIBLE",
    rarity: "EPIC",
    iconKey: "item.magic-compass",
    maxQuantity: 1,
    config: {},
  },
  {
    key: "cove-pearl",
    name: "Cove Pearl",
    description: "A glowing pearl from the hidden cove. Only sharp-eyed captains find it.",
    type: "COLLECTIBLE",
    rarity: "UNCOMMON",
    iconKey: "item.cove-pearl",
    maxQuantity: 1,
    config: {},
  },
  // --- Ships (tiers) ---
  {
    key: "ship-starter",
    name: "Starter Ship",
    description: "A sturdy little sloop. Every captain starts somewhere.",
    type: "SHIP",
    iconKey: "ship.starter",
    maxQuantity: 1,
    config: { tier: 1 },
  },
  {
    key: "ship-explorer",
    name: "Explorer Ship",
    description: "Faster sails and a bigger hold.",
    type: "SHIP",
    rarity: "UNCOMMON",
    iconKey: "ship.explorer",
    maxQuantity: 1,
    config: { tier: 2, costCoins: 150, requiresChapterKey: "parrot-island" },
  },
  {
    key: "ship-voyager",
    name: "Voyager Ship",
    description: "Built for long journeys across open water.",
    type: "SHIP",
    rarity: "RARE",
    iconKey: "ship.voyager",
    maxQuantity: 1,
    config: { tier: 3, costCoins: 400, requiresChapterKey: "shipwreck-cove" },
  },
  {
    key: "ship-captain",
    name: "Captain Ship",
    description: "A command vessel worthy of a true captain.",
    type: "SHIP",
    rarity: "EPIC",
    iconKey: "ship.captain",
    maxQuantity: 1,
    config: { tier: 4, costCoins: 800, requiresChapterKey: "skull-reef" },
  },
  {
    key: "ship-legendary",
    name: "Legendary Ship",
    description: "Whispered about in every port. Only legends sail her.",
    type: "SHIP",
    rarity: "LEGENDARY",
    iconKey: "ship.legendary",
    maxQuantity: 1,
    config: { tier: 5, costCoins: 1500, requiresChapterKey: "whispering-jungle" },
  },
  // --- Ship upgrades (cosmetic/progression) ---
  {
    key: "upgrade-patched-sail",
    name: "Patched Sail",
    description: "A colourful patch for your sail.",
    type: "SHIP_UPGRADE",
    iconKey: "upgrade.patched-sail",
    maxQuantity: 1,
    config: { costCoins: 40, slot: "sail", requiresShipTier: 1 },
  },
  {
    key: "upgrade-parrot-perch",
    name: "Parrot Perch",
    description: "A perch so Pip can ride along.",
    type: "SHIP_UPGRADE",
    rarity: "UNCOMMON",
    iconKey: "upgrade.parrot-perch",
    maxQuantity: 1,
    config: { costCoins: 90, slot: "deck", requiresShipTier: 1, requiresItemKey: "magic-compass" },
  },
  {
    key: "upgrade-brass-cannon",
    name: "Brass Cannon",
    description: "For scaring off krakens. Mostly.",
    type: "SHIP_UPGRADE",
    rarity: "RARE",
    iconKey: "upgrade.brass-cannon",
    maxQuantity: 1,
    config: { costCoins: 200, slot: "deck", requiresShipTier: 2 },
  },
  // --- Cosmetics ---
  {
    key: "cosmetic-captain-hat",
    name: "Captain's Hat",
    description: "A fine feathered hat.",
    type: "COSMETIC",
    iconKey: "cosmetic.captain-hat",
    maxQuantity: 1,
    config: { costCoins: 60, slot: "head" },
  },
];
