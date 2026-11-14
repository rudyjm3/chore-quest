import Link from "next/link";

import { Button } from "@/components/ui/button";
import { lighthouseHint } from "@/game/engine";
import { prisma } from "@/lib/db/prisma";
import { requireChildContext } from "@/server/policies/context";
import { LookOutButton } from "@/features/adventures/components/look-out-button";
import { getAdventureState } from "@/server/services/adventure.service";
import { getLighthouseStatus } from "@/server/services/location.service";

export const metadata = { title: "Lighthouse" };

export default async function LighthousePage() {
  const ctx = await requireChildContext();
  const [state, status] = await Promise.all([
    getAdventureState(prisma, ctx, "pirate"),
    getLighthouseStatus(prisma, ctx, { adventureKey: "pirate" }),
  ]);
  // One look per local day (ADR 0017): the hint appears after today's look, decided by the server.
  const hint = state.started && status.lookedToday ? lighthouseHint(state.chapters) : null;
  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="min-h-11">
        <Link href="/child/port">← Home Port</Link>
      </Button>
      <h1 className="text-2xl font-black">Lighthouse</h1>
      <div
        className="space-y-3 rounded-3xl border-4 border-pirate-wood bg-pirate-parchment p-6 text-center"
        data-testid="lighthouse-hint"
        data-looked={status.lookedToday}
      >
        <p className="text-4xl" aria-hidden="true">
          🔭
        </p>
        {!state.started ? (
          <p className="text-lg">
            The sea is quiet. Join the crew and come back to look out over the water!
          </p>
        ) : status.lookedToday ? (
          <>
            <p className="text-lg">{hint ?? "The sea is calm. Nothing new on the horizon."}</p>
            <p className="text-sm text-muted-foreground">
              You have looked out to sea today. Come back tomorrow!
            </p>
          </>
        ) : (
          <>
            <p className="text-lg">The lamp is lit. Take a look at the horizon.</p>
            <LookOutButton />
          </>
        )}
      </div>
    </div>
  );
}
