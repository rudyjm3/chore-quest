import { crewCampSceneSchema } from "@/game/schemas";

/** Where each wearable slot sits on the pirate ship in the crew-camp scene (ADR 0018). */
export const pirateCrewCampScene = crewCampSceneSchema.parse({
  shipAssetId: "ship.starter",
  slots: {
    head: { x: 50, y: 14, label: "Head" },
    sail: { x: 50, y: 40, label: "Sail" },
    deck: { x: 50, y: 76, label: "Deck" },
  },
});
