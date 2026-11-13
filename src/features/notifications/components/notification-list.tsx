import Link from "next/link";

import type { NotificationPage } from "@/server/services/notification.service";

import { MarkReadForm } from "./mark-read-form";

const KIND_ICON: Record<string, string> = {
  SUBMISSION_PENDING: "📝",
  SUBMISSION_APPROVED: "✅",
  SUBMISSION_REJECTED: "🔁",
  REDEMPTION_REQUESTED: "🎁",
  REDEMPTION_RESOLVED: "🎉",
};

/**
 * Server-rendered notification list shared by the parent and child inboxes. Paging is a plain
 * link with a cursor, so it works without JavaScript. Each notification links to the screen it
 * is about; nothing here leaves the app.
 */
export function NotificationList({
  page,
  variant,
  basePath,
  linkFor,
}: {
  page: NotificationPage;
  variant: "parent" | "child";
  basePath: string;
  linkFor: (entityType: string | null, kind: string) => string | null;
}) {
  const hasUnread = page.items.some((n) => !n.readAt);
  return (
    <div className="space-y-3" data-testid="notification-list">
      {hasUnread ? <MarkReadForm variant={variant} /> : null}
      {page.items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {variant === "child" ? "No news yet. Check back soon!" : "You are all caught up."}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {page.items.map((n) => {
            const href = linkFor(n.entityType, n.kind);
            return (
              <li
                key={n.id}
                className="flex gap-3 px-4 py-3 text-sm"
                data-unread={n.readAt ? "false" : "true"}
              >
                <span aria-hidden className="text-xl">
                  {KIND_ICON[n.kind] ?? "🔔"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={n.readAt ? "" : "font-semibold"}>
                    {href ? (
                      <Link href={href} className="hover:underline">
                        {n.title}
                      </Link>
                    ) : (
                      n.title
                    )}
                    {n.readAt ? null : <span className="sr-only"> (unread)</span>}
                  </p>
                  {n.body ? <p className="text-muted-foreground">{n.body}</p> : null}
                  <p className="text-xs text-muted-foreground">
                    <time dateTime={n.createdAt.toISOString()}>
                      {n.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                    </time>
                  </p>
                </div>
                {n.readAt ? null : (
                  <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full bg-brand" />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {page.nextCursor ? (
        <Link
          href={`${basePath}?cursor=${page.nextCursor}`}
          className="inline-block text-sm font-medium text-brand hover:underline"
        >
          Older notifications
        </Link>
      ) : null}
    </div>
  );
}
