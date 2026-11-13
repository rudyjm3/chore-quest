import Link from "next/link";

import { Button } from "@/components/ui/button";
import { VisitLocationButton } from "@/features/adventures/components/visit-location-button";
import { prisma } from "@/lib/db/prisma";
import { requireChildContext } from "@/server/policies/context";
import { getLocationStatus } from "@/server/services/location.service";

export const metadata = { title: "Hidden cove" };
export const dynamic = "force-dynamic";

const PLACE = { chapterKey: "home-port", locationKey: "hidden-cove" } as const;

export default async function HiddenCovePage() {
  const ctx = await requireChildContext();
  const place = await getLocationStatus(prisma, ctx, { adventureKey: "pirate", ...PLACE });
  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="min-h-11">
        <Link href="/child/port">← Home Port</Link>
      </Button>
      <h1 className="text-2xl font-black">Hidden cove</h1>
      <div
        className="space-y-3 rounded-3xl border-4 border-pirate-wood bg-pirate-parchment p-6 text-center"
        data-testid="cove-state"
        data-state={place.status}
        aria-live="polite"
      >
        <p className="text-4xl" aria-hidden="true">
          🌊
        </p>
        {place.status === "not-started" ? (
          <p className="text-lg">
            Join the crew first.{" "}
            <Link href="/child/adventure" className="font-bold underline">
              Start your adventure
            </Link>
          </p>
        ) : place.status === "locked" ? (
          <p className="text-lg">
            Something glints behind the rocks, but you cannot reach it yet. Keep collecting treasure
            map pieces!
          </p>
        ) : place.status === "found" ? (
          <p className="text-lg">✅ You found the cove pearl. What a sharp-eyed captain!</p>
        ) : (
          <>
            <p className="text-lg">Something glints behind the rocks...</p>
            <VisitLocationButton
              chapterKey={PLACE.chapterKey}
              locationKey={PLACE.locationKey}
              label="Look behind the rocks"
              successMessage="You found a Cove Pearl!"
            />
          </>
        )}
      </div>
    </div>
  );
}
