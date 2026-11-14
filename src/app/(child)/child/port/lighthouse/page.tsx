import Link from "next/link";

import { Button } from "@/components/ui/button";
import { lighthouseHint } from "@/game/engine";
import { prisma } from "@/lib/db/prisma";
import { requireChildContext } from "@/server/policies/context";
import { getAdventureState } from "@/server/services/adventure.service";

export const metadata = { title: "Lighthouse" };

export default async function LighthousePage() {
  const ctx = await requireChildContext();
  const state = await getAdventureState(prisma, ctx, "pirate");
  const hint = state.started ? lighthouseHint(state.chapters) : null;
  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="min-h-11">
        <Link href="/child/port">← Home Port</Link>
      </Button>
      <h1 className="text-2xl font-black">Lighthouse</h1>
      <div
        className="space-y-2 rounded-3xl border-4 border-pirate-wood bg-pirate-parchment p-6 text-center"
        data-testid="lighthouse-hint"
      >
        <p className="text-4xl" aria-hidden="true">
          🔭
        </p>
        <p className="text-lg">
          {hint ?? "The sea is quiet. Join the crew and come back to look out over the water!"}
        </p>
      </div>
    </div>
  );
}
