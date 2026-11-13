import Link from "next/link";
import type { ReactNode } from "react";

import { ResourceCounter } from "@/components/shared/resource-counter";

import { ChildNav } from "./child-nav";

export function ChildShell({
  children,
  childName,
  wallets,
  signOut,
  unreadCount = 0,
}: {
  children: ReactNode;
  childName: string;
  wallets: { POINTS: number; COINS: number; XP: number };
  signOut: ReactNode;
  unreadCount?: number;
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
            <Link
              href="/child/notifications"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-pirate-gold/60 bg-pirate-ink/40 px-3 text-sm font-bold"
              data-testid="child-bell"
            >
              <span aria-hidden>🔔</span>
              <span className="sr-only">News</span>
              {unreadCount > 0 ? (
                <span className="ml-1" data-testid="child-unread">
                  {unreadCount > 99 ? "99+" : unreadCount}
                  <span className="sr-only"> unread</span>
                </span>
              ) : null}
            </Link>
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
