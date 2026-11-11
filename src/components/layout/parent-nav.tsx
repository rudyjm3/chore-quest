"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export const PARENT_LINKS = [
  { href: "/parent", label: "Dashboard", icon: "🏠" },
  { href: "/parent/approvals", label: "Approvals", icon: "✅" },
  { href: "/parent/children", label: "Children", icon: "🧒" },
  { href: "/parent/tasks", label: "Tasks", icon: "🧹" },
  { href: "/parent/routines", label: "Routines", icon: "🌅" },
  { href: "/parent/goals", label: "Goals", icon: "🎯" },
  { href: "/parent/rewards", label: "Rewards", icon: "⭐" },
  { href: "/parent/settings", label: "Settings", icon: "⚙️" },
] as const;

export function ParentNav({ variant }: { variant: "sidebar" | "bottom" }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/parent" ? pathname === href : pathname.startsWith(href);
  const links = variant === "bottom" ? PARENT_LINKS.slice(0, 5) : PARENT_LINKS;
  return (
    <nav aria-label="Parent navigation" data-testid={`parent-nav-${variant}`}>
      <ul className={cn(variant === "sidebar" ? "flex flex-col gap-1" : "flex justify-around")}>
        {links.map((link) => (
          <li key={link.href} className={variant === "bottom" ? "flex-1" : undefined}>
            <Link
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                variant === "bottom" && "flex-col gap-0.5 px-1 py-1.5 text-[11px]",
                isActive(link.href)
                  ? "bg-brand/10 text-brand"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span aria-hidden>{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
