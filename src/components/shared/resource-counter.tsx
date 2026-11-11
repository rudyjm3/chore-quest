import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Compact "icon + number" chip for points, coins, XP, crates, feathers... */
export function ResourceCounter({
  icon,
  label,
  value,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm font-semibold",
        className,
      )}
      title={label}
      aria-label={`${label}: ${value}`}
    >
      <span aria-hidden className="text-base leading-none">
        {icon}
      </span>
      <span>{value}</span>
      <span className="sr-only">{label}</span>
    </div>
  );
}
