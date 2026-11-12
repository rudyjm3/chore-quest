import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { startChildSessionAction } from "@/features/families/actions";
import {
  AddChildForm,
  ArchiveChildButton,
  EditChildForm,
  RestoreChildButton,
  SetPinForm,
} from "@/features/families/components/family-forms";
import { avatarGlyph } from "@/lib/avatars";
import { prisma } from "@/lib/db/prisma";
import { requireParentContext } from "@/server/policies/context";
import { listArchivedChildren, listChildren } from "@/server/services/child.service";
import { getWallets } from "@/server/services/reward.service";

export const metadata = { title: "Children" };

export default async function ChildrenPage() {
  const ctx = await requireParentContext();
  const [children, archived] = await Promise.all([
    listChildren(prisma, ctx.familyId),
    listArchivedChildren(prisma, ctx.familyId),
  ]);
  const wallets = await Promise.all(children.map((c) => getWallets(prisma, c.id)));
  const family = await prisma.family.findUniqueOrThrow({
    where: { id: ctx.familyId },
    select: { childLoginCode: true },
  });

  return (
    <>
      <PageHeader
        title="Children"
        description={`Family code for child sign-in: ${family.childLoginCode}`}
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Add a child</CardTitle>
        </CardHeader>
        <CardContent>
          <AddChildForm />
        </CardContent>
      </Card>
      {children.length === 0 ? (
        <EmptyState title="No children yet" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2" data-testid="children-list">
          {children.map((child, i) => (
            <Card key={child.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  <span aria-hidden className="mr-2 text-xl">
                    {avatarGlyph(child.avatarKey)}
                  </span>
                  {child.displayName}
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {!child.credential
                    ? "No PIN yet"
                    : child.credential.lockedUntil && child.credential.lockedUntil > new Date()
                      ? "PIN locked: resetting it unlocks"
                      : "PIN set"}
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  ⭐ {wallets[i].POINTS} points · 🪙 {wallets[i].COINS} coins · ✨ {wallets[i].XP}{" "}
                  XP
                </p>
                <SetPinForm childId={child.id} />
                <details>
                  <summary className="cursor-pointer text-sm text-primary">Edit profile</summary>
                  <div className="mt-2">
                    <EditChildForm child={child} />
                  </div>
                </details>
                <form action={startChildSessionAction}>
                  <input type="hidden" name="childId" value={child.id} />
                  <Button type="submit" size="sm" variant="secondary">
                    Hand device to {child.displayName} (signs you out)
                  </Button>
                </form>
                <ArchiveChildButton childId={child.id} name={child.displayName} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {archived.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Archived children</h2>
          <ul className="divide-y rounded-xl border bg-card" data-testid="archived-children">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{c.displayName}</span>
                <RestoreChildButton childId={c.id} name={c.displayName} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
