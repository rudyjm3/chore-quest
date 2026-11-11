import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <div className="space-y-3">
        <p className="text-sm font-semibold tracking-widest text-brand uppercase">Chore Quests</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Everyday chores, epic adventures.
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          Parents assign real-world responsibilities. Kids complete them to earn points,
          achievements and progress through adventure worlds like{" "}
          <em>The Lost Treasure of Blackbeard Bay</em>.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row" data-testid="landing-actions">
        <Button asChild size="lg">
          <Link href="/sign-in">Parent sign in</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/sign-up">Create a family</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/child/sign-in">I&apos;m a kid</Link>
        </Button>
      </div>
    </main>
  );
}
