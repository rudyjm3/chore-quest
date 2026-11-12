import { redirect } from "next/navigation";

import { SignUpForm } from "@/features/families/components/auth-forms";
import { getParentSession } from "@/lib/auth/session";

export const metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const session = await getParentSession();
  if (session) redirect("/parent");
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  return <SignUpForm next={next} />;
}
