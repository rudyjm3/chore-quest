import { redirect } from "next/navigation";

import { ChildShell } from "@/components/layout/child-shell";
import { Button } from "@/components/ui/button";
import { childSignOutAction } from "@/features/adventures/actions";
import { prisma } from "@/lib/db/prisma";
import { getChildContext } from "@/server/policies/context";
import { countUnread } from "@/server/services/notification.service";
import { getWallets } from "@/server/services/reward.service";

/** Child area gate: a valid child session is required on every request. */
export default async function ChildLayout({ children }: LayoutProps<"/child">) {
  const ctx = await getChildContext();
  if (!ctx) redirect("/child/sign-in");
  const [wallets, unreadCount] = await Promise.all([
    getWallets(prisma, ctx.childId),
    countUnread(prisma, ctx),
  ]);
  return (
    <ChildShell
      childName={ctx.childName}
      wallets={wallets}
      unreadCount={unreadCount}
      signOut={
        <form action={childSignOutAction}>
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white"
          >
            Log out
          </Button>
        </form>
      }
    >
      {children}
    </ChildShell>
  );
}
