import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-6 text-sm font-semibold tracking-widest text-brand uppercase">
        Chore Quests
      </Link>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">{children}</div>
    </div>
  );
}
