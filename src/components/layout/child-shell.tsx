import type { ReactNode } from "react";

import { ResourceCounter } from "@/components/shared/resource-counter";

import { ChildNav } from "./child-nav";

export function ChildShell({
  children,
  childName,
  wallets,
  signOut,
}: {
  children: ReactNode;
  childName: string;
  wallets: { POINTS: number; COINS: number; XP: number };
  signOut: ReactNode;
}) {
  return (
    <div
      className="theme-child flex min-h-full flex-1 flex-col bg-background text-foreground"
      data-testid="child-shell"
    >
      <header className="sticky top-0 z-10 border-b-4 border-pirate-wood bg-pirate-wood-dark px-4 py-3 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-widest text-pirate-gold uppercase">
              Chore Quests
            </p>
            <p className="text-lg font-bold" data-testid="child-name">
              Ahoy, {childName}!
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <ResourceCounter
              icon="⭐"
              label="Points"
              value={wallets.POINTS}
              className="border-pirate-gold/60 bg-pirate-ink/40 text-white"
            />
            <ResourceCounter
              icon="🪙"
              label="Coins"
              value={wallets.COINS}
              className="border-pirate-gold/60 bg-pirate-ink/40 text-white"
            />
            <ResourceCounter
              icon="✨"
              label="XP"
              value={wallets.XP}
              className="border-pirate-gold/60 bg-pirate-ink/40 text-white"
            />
            {signOut}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5 pb-28">{children}</main>
      <div className="fixed inset-x-0 bottom-0 border-t-4 border-pirate-wood bg-pirate-sand/95 px-3 py-2 backdrop-blur">
        <div className="mx-auto max-w-4xl">
          <ChildNav />
        </div>
      </div>
    </div>
  );
}
