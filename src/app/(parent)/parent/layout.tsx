import { redirect } from "next/navigation";

import { ParentShell } from "@/components/layout/parent-shell";
import { SignOutButton } from "@/features/families/components/auth-forms";
import { getParentContext } from "@/server/policies/context";

/**
 * Parent area gate. Authorization is enforced here on every request (the
 * proxy only does a cookie presence check). Users without a family are sent
 * to onboarding, which lives outside this layout.
 */
export default async function ParentLayout({ children }: LayoutProps<"/parent">) {
  const ctx = await getParentContext();
  if (!ctx) redirect("/sign-in?next=/parent");
  if (ctx.kind === "parent-no-family") redirect("/parent/onboarding");
  return (
    <ParentShell familyName={ctx.familyName} userName={ctx.userName} signOut={<SignOutButton />}>
      {children}
    </ParentShell>
  );
}
