import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ProgressBar } from "./progress-bar";
import { StatusBadge } from "./status-badge";

export interface QuestCardObjective {
  key: string;
  title: string;
  currentCount: number;
  targetCount: number;
  completed: boolean;
}

export function QuestCard({
  title,
  description,
  kind,
  status,
  objectives,
  reward,
}: {
  title: string;
  description?: string | null;
  kind: "MAIN" | "SIDE";
  status: string;
  objectives: QuestCardObjective[];
  /** Optional reward preview line, already formatted. */
  reward?: string;
}) {
  return (
    <Card
      className="border-2 border-pirate-wood/40 bg-pirate-parchment"
      data-testid="quest-card"
      data-kind={kind}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-pirate-wood uppercase">
            {kind === "MAIN" ? "Main quest" : "Side mission"}
          </p>
          <CardTitle className="text-lg">{title}</CardTitle>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <StatusBadge status={status} />
      </CardHeader>
      <CardContent className="space-y-3">
        {objectives.map((objective) => (
          <ProgressBar
            key={objective.key}
            value={objective.currentCount}
            max={objective.targetCount}
            label={`${objective.completed ? "✅ " : ""}${objective.title}`}
          />
        ))}
        {reward ? (
          <p className="text-sm font-semibold" data-testid="quest-reward">
            Reward: {reward}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
