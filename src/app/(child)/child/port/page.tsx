import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

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
    href: "/child/supplies",
    icon: "⚓",
    title: "Supply shop",
    text: "Spend your coins on new gear.",
  },
] as const;

export default function HomePortPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Home Port</h1>
      <ul className="grid gap-3 sm:grid-cols-3" data-testid="port-places">
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
