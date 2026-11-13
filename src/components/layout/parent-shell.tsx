import type { ReactNode } from "react";

import { ParentNav } from "./parent-nav";

export function ParentShell({
  children,
  familyName,
  userName,
  signOut,
  unreadCount = 0,
}: {
  children: ReactNode;
  familyName: string;
  userName: string;
  signOut: ReactNode;
  unreadCount?: number;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row" data-testid="parent-shell">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card p-4 md:flex">
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-widest text-brand uppercase">Chore Quests</p>
          <p className="truncate font-semibold" data-testid="family-name">
            {familyName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{userName}</p>
        </div>
        <ParentNav variant="sidebar" unread={unreadCount} />
        <div className="mt-auto pt-4">{signOut}</div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <div>
            <p className="text-xs font-semibold tracking-widest text-brand uppercase">
              Chore Quests
            </p>
            <p className="text-sm font-semibold" data-testid="family-name">
              {familyName}
            </p>
          </div>
          {signOut}
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:pb-8">{children}</main>
        <div className="fixed inset-x-0 bottom-0 border-t bg-card/95 px-2 py-1 backdrop-blur md:hidden">
          <ParentNav variant="bottom" unread={unreadCount} />
        </div>
      </div>
    </div>
  );
}
