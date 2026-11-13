"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

const PARENT_LINKS = [
  { href: "/parent", label: "Dashboard", icon: "🏠" },
  { href: "/parent/approvals", label: "Approvals", icon: "✅" },
  { href: "/parent/children", label: "Children", icon: "🧒" },
  { href: "/parent/tasks", label: "Tasks", icon: "🧹" },
  { href: "/parent/routines", label: "Routines", icon: "🌅" },
  { href: "/parent/history", label: "History", icon: "📜" },
  { href: "/parent/goals", label: "Goals", icon: "🎯" },
  { href: "/parent/rewards", label: "Rewards", icon: "⭐" },
  { href: "/parent/notifications", label: "Inbox", icon: "🔔" },
  { href: "/parent/audit", label: "Log", icon: "🧾" },
  { href: "/parent/settings", label: "Settings", icon: "⚙️" },
] as const;

/** On phones the bottom bar holds the first links; the rest live behind "More". */
const BOTTOM_PRIMARY = 4;

export function ParentNav({
  variant,
  unread = 0,
}: {
  variant: "sidebar" | "bottom";
  unread?: number;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/parent" ? pathname === href : pathname.startsWith(href);
  const primary = variant === "bottom" ? PARENT_LINKS.slice(0, BOTTOM_PRIMARY) : PARENT_LINKS;
  const overflow = variant === "bottom" ? PARENT_LINKS.slice(BOTTOM_PRIMARY) : [];
  const overflowActive = overflow.some((l) => isActive(l.href));

  const renderLink = (link: (typeof PARENT_LINKS)[number], extraClass?: string) => (
    <Link
      href={link.href}
      aria-current={isActive(link.href) ? "page" : undefined}
      onClick={() => setMoreOpen(false)}
      className={cn(
        "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        extraClass,
        isActive(link.href)
          ? "bg-brand/10 text-brand"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span aria-hidden>{link.icon}</span>
      <span>{link.label}</span>
      {link.href === "/parent/notifications" && unread > 0 ? (
        <span
          className="ml-auto rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white"
          data-testid="unread-badge"
        >
          {unread > 99 ? "99+" : unread}
          <span className="sr-only"> unread</span>
        </span>
      ) : null}
    </Link>
  );

  return (
    <nav aria-label="Parent navigation" data-testid={`parent-nav-${variant}`}>
      <ul className={cn(variant === "sidebar" ? "flex flex-col gap-1" : "flex justify-around")}>
        {primary.map((link) => (
          <li key={link.href} className={variant === "bottom" ? "flex-1" : undefined}>
            {renderLink(
              link,
              variant === "bottom" ? "flex-col gap-0.5 px-1 py-1.5 text-[11px]" : "",
            )}
          </li>
        ))}
        {variant === "bottom" ? (
          <li className="relative flex-1">
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-controls="parent-more-menu"
              onClick={() => setMoreOpen((open) => !open)}
              className={cn(
                "flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium",
                overflowActive ? "bg-brand/10 text-brand" : "text-muted-foreground",
              )}
            >
              <span aria-hidden>⋯</span>
              <span>More{unread > 0 ? ` (${unread > 99 ? "99+" : unread})` : ""}</span>
            </button>
            {moreOpen ? (
              <ul
                id="parent-more-menu"
                className="absolute right-0 bottom-full mb-2 w-44 space-y-1 rounded-xl border bg-card p-2 shadow-lg"
              >
                {overflow.map((link) => (
                  <li key={link.href}>{renderLink(link)}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
