import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { selectLine } from "@/game/engine";
import { getNpcDialogue } from "@/game/themes";
import { prisma } from "@/lib/db/prisma";
import { todayIn } from "@/lib/utils/dates";
import { requireChildContext } from "@/server/policies/context";
import { getAdventureState } from "@/server/services/adventure.service";

export const metadata = { title: "Home Port" };

const PLACES = [
  {
    href: "/child/port/quest-board",
    icon: "📜",
    title: "Quest board",
    text: "See the quests you are working on.",
  },
  {
    href: "/child/port/crew-camp",
    icon: "⛺",
    title: "Crew camp",
    text: "Dress up your ship and crew.",
  },
  {
    href: "/child/port/lighthouse",
    icon: "🔭",
    title: "Lighthouse",
    text: "Look out to sea for a hint.",
  },
  {
    href: "/child/supplies",
    icon: "⚓",
    title: "Supply shop",
    text: "Spend your coins on new gear.",
  },
] as const;

export default async function HomePortPage() {
  const ctx = await requireChildContext();
  const [state, family] = await Promise.all([
    getAdventureState(prisma, ctx, "pirate"),
    prisma.family.findUnique({ where: { id: ctx.familyId }, select: { timezone: true } }),
  ]);
  const pip = getNpcDialogue(state.adventure.themeKey, "pip");
  const talk = pip
    ? selectLine(
        pip,
        {
          started: state.started,
          hasUnclaimedChapterReward: state.chapters.some(
            (c) => c.status === "COMPLETED" && !c.rewardClaimed,
          ),
          inventory: state.inventory,
        },
        todayIn(family?.timezone ?? "UTC"),
      )
    : null;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Home Port</h1>
      {pip && talk ? (
        <figure
          className="flex items-start gap-3 rounded-3xl border-4 border-pirate-wood bg-pirate-parchment p-4"
          data-testid="npc-dialogue"
          data-situation={talk.situation}
        >
          <span className="text-4xl" aria-hidden="true">
            🦜
          </span>
          <figcaption className="space-y-1">
            <span className="block text-sm font-bold text-pirate-wood">{pip.name}</span>
            <span className="block text-lg">{talk.line}</span>
          </figcaption>
        </figure>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="port-places">
        {PLACES.map((place) => (
          <li key={place.href}>
            <Link
              href={place.href}
              className="block min-h-11 rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Card className="h-full border-2 border-pirate-wood/30 bg-pirate-parchment">
                <CardContent className="space-y-1">
                  <p className="text-3xl" aria-hidden="true">
                    {place.icon}
                  </p>
                  <p className="text-lg font-black">{place.title}</p>
                  <p className="text-sm text-muted-foreground">{place.text}</p>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
