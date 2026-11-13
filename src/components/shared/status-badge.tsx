import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-info/15 text-info",
  SUBMITTED: "bg-warning/25 text-foreground",
  APPROVED: "bg-success/20 text-success",
  COMPLETED: "bg-success/20 text-success",
  CLAIMED: "bg-success/20 text-success",
  REJECTED: "bg-danger/15 text-danger",
  MISSED: "bg-danger/15 text-danger",
  SKIPPED: "bg-muted text-muted-foreground",
  ACTIVE: "bg-brand/15 text-brand",
  PAUSED: "bg-muted text-muted-foreground",
  ARCHIVED: "bg-muted text-muted-foreground",
  LOCKED: "bg-muted text-muted-foreground",
  UNLOCKED: "bg-info/15 text-info",
  EXPIRED: "bg-muted text-muted-foreground",
  REQUESTED: "bg-warning/25 text-foreground",
  DENIED: "bg-danger/15 text-danger",
  FULFILLED: "bg-success/20 text-success",
};

const LABELS: Record<string, string> = {
  PENDING: "To do",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Waiting for review",
  APPROVED: "Approved",
  COMPLETED: "Completed",
  CLAIMED: "Claimed",
  REJECTED: "Try again",
  MISSED: "Missed",
  SKIPPED: "Skipped",
  ACTIVE: "Active",
  PAUSED: "Paused",
  ARCHIVED: "Archived",
  LOCKED: "Locked",
  UNLOCKED: "Unlocked",
  EXPIRED: "Expired",
  REQUESTED: "Waiting",
  DENIED: "Not this time",
  FULFILLED: "Given",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-medium", STYLES[status], className)}
      data-status={status}
    >
      {LABELS[status] ?? status}
    </Badge>
  );
}
