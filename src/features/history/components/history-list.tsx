import type { HistoryItem } from "@/server/services/history.service";

/** Server-rendered list shared by the parent and child history pages. */
export function HistoryList({
  items,
  showChild,
  emptyText,
}: {
  items: HistoryItem[];
  showChild: boolean;
  emptyText: string;
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="divide-y rounded-xl border bg-card" data-testid="history-list">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
          <span>
            <span className="font-medium">{item.title}</span>
            {showChild ? <span className="text-muted-foreground"> · {item.childName}</span> : null}
            <span className="block text-xs text-muted-foreground">
              {item.localDate} · {item.kind === "ROUTINE" ? "Routine" : "Task"}
            </span>
          </span>
          <span className="shrink-0 font-semibold">+{item.points} pts</span>
        </li>
      ))}
    </ul>
  );
}
