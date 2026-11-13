"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/child", label: "Today", icon: "☀️" },
  { href: "/child/goals", label: "Goals", icon: "🎯" },
  { href: "/child/adventure", label: "Adventure", icon: "🗺️" },
  { href: "/child/rewards", label: "Shop", icon: "🎁" },
  { href: "/child/achievements", label: "Badges", icon: "🏅" },
  { href: "/child/history", label: "History", icon: "📜" },
] as const;

export function ChildNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Child navigation" data-testid="child-nav">
      <ul className="flex justify-around gap-1">
        {LINKS.map((link) => {
          const active =
            link.href === "/child" ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <li key={link.href} className="flex-1">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs font-bold transition-colors",
                  active
                    ? "bg-pirate-gold text-pirate-ink"
                    : "text-pirate-ink/70 hover:bg-pirate-parchment",
                )}
              >
                <span className="text-xl" aria-hidden>
                  {link.icon}
                </span>
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
