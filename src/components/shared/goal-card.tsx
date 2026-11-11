import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ProgressBar } from "./progress-bar";
import { StatusBadge } from "./status-badge";

export function GoalCard({
  title,
  description,
  progress,
  target,
  status,
  streak,
  rewardPoints,
}: {
  title: string;
  description?: string | null;
  progress: number;
  target: number;
  status: string;
  streak?: number;
  rewardPoints?: number;
}) {
  return (
    <Card data-testid="goal-card">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <StatusBadge status={status} />
      </CardHeader>
      <CardContent className="space-y-2">
        <ProgressBar value={progress} max={target} label="Progress" />
        <div className="flex gap-4 text-xs text-muted-foreground">
          {streak !== undefined ? <span>🔥 Streak: {streak}</span> : null}
          {rewardPoints ? <span>⭐ Reward: {rewardPoints} points</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
