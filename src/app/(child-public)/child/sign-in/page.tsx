import Link from "next/link";
import { redirect } from "next/navigation";

import { ChildSignIn } from "@/features/adventures/components/child-sign-in";
import { getChildContext } from "@/server/policies/context";

export const metadata = { title: "Kid sign in" };

export default async function ChildSignInPage() {
  const ctx = await getChildContext();
  if (ctx) redirect("/child");
  return (
    <div className="theme-child flex flex-1 flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
      <Link href="/" className="mb-6 text-sm font-bold tracking-widest text-pirate-wood uppercase">
        Chore Quests
      </Link>
      <div className="w-full max-w-sm rounded-3xl border-4 border-pirate-wood bg-pirate-parchment p-6 shadow-xl">
        <ChildSignIn />
      </div>
    </div>
  );
}
