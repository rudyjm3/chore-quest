import { redirect } from "next/navigation";

import { SignInForm } from "@/features/families/components/auth-forms";
import { getParentSession } from "@/lib/auth/session";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const session = await getParentSession();
  if (session) redirect("/parent");
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  return <SignInForm next={next} />;
}
