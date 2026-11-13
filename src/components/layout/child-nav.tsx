"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

const PRIMARY = [
  { href: "/child", label: "Today", icon: "☀️" },
  { href: "/child/goals", label: "Goals", icon: "🎯" },
  { href: "/child/adventure", label: "Adventure", icon: "🗺️" },
  { href: "/child/supplies", label: "Supplies", icon: "⚓" },
] as const;

/** Behind "More" so the bottom bar keeps big, uncrowded touch targets. */
const MORE = [
  { href: "/child/inventory", label: "Treasure chest", icon: "🧰" },
  { href: "/child/rewards", label: "Reward shop", icon: "🎁" },
  { href: "/child/achievements", label: "Badges", icon: "🏅" },
  { href: "/child/history", label: "History", icon: "📜" },
] as const;

const itemClass =
  "flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs font-bold transition-colors";

export function ChildNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/child" ? pathname === href : pathname.startsWith(href);
  const moreActive = MORE.some((l) => isActive(l.href));
  return (
    <nav aria-label="Child navigation" data-testid="child-nav">
      <ul className="flex justify-around gap-1">
        {PRIMARY.map((link) => (
          <li key={link.href} className="flex-1">
            <Link
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                itemClass,
                isActive(link.href)
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
        ))}
        <li className="relative flex-1">
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="child-more-menu"
            onClick={() => setMoreOpen((open) => !open)}
            className={cn(
              itemClass,
              "w-full",
              moreActive
                ? "bg-pirate-gold text-pirate-ink"
                : "text-pirate-ink/70 hover:bg-pirate-parchment",
            )}
          >
            <span className="text-xl" aria-hidden>
              ⋯
            </span>
            More
          </button>
          {moreOpen ? (
            <ul
              id="child-more-menu"
              className="absolute right-0 bottom-full z-20 mb-2 w-48 space-y-1 rounded-2xl border-2 border-pirate-wood/40 bg-pirate-parchment p-2 shadow-lg"
            >
              {MORE.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold",
                      isActive(link.href) ? "bg-pirate-gold text-pirate-ink" : "hover:bg-white/60",
                    )}
                  >
                    <span aria-hidden>{link.icon}</span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      </ul>
    </nav>
  );
}
