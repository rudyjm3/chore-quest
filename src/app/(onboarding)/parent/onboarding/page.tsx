import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { CreateFamilyForm } from "@/features/families/components/family-forms";
import { getParentContext } from "@/server/policies/context";

export const metadata = { title: "Create your family" };

export default async function OnboardingPage() {
  const ctx = await getParentContext();
  if (!ctx) redirect("/sign-in?next=/parent/onboarding");
  if (ctx.kind === "parent") redirect("/parent");
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-12">
      <PageHeader
        title={`Welcome, ${ctx.userName}!`}
        description="Set up your household. You can add children and other guardians next."
      />
      <CreateFamilyForm />
    </main>
  );
}
