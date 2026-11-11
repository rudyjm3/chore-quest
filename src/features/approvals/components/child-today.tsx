"use client";

import { ActionForm } from "@/components/shared/action-form";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { Card, CardContent } from "@/components/ui/card";

import { completeRoutineStepAction, submitOccurrenceAction } from "../actions";

export interface TodayOccurrence {
  id: string;
  title: string;
  points: number;
  status: string;
  dueTime: string | null;
}

export interface TodayRun {
  id: string;
  name: string;
  status: string;
  bonusPoints: number;
  steps: Array<{ stepId: string; title: string; status: string }>;
}

export function ChildTodayList({
  occurrences,
  runs,
}: {
  occurrences: TodayOccurrence[];
  runs: TodayRun[];
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-3" data-testid="today-chores">
        <h2 className="text-xl font-black">Today&apos;s chores</h2>
        {occurrences.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-pirate-wood/40 p-6 text-center">
            No chores today. Enjoy the sunshine! ☀️
          </p>
        ) : null}
        {occurrences.map((o) => (
          <Card key={o.id} className="border-2 border-pirate-wood/30">
            <CardContent className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{o.title}</p>
                <p className="text-sm text-muted-foreground">
                  ⭐ {o.points} points{o.dueTime ? ` · by ${o.dueTime}` : ""}
                </p>
              </div>
              {o.status === "PENDING" || o.status === "REJECTED" ? (
                <ActionForm
                  action={submitOccurrenceAction}
                  successMessage="Great job! Sent for review."
                  className="space-y-0"
                >
                  <input type="hidden" name="occurrenceId" value={o.id} />
                  <SubmitButton
                    className="h-12 rounded-2xl px-5 text-base font-black"
                    data-testid="done-button"
                  >
                    I did it!
                  </SubmitButton>
                </ActionForm>
              ) : (
                <StatusBadge status={o.status} />
              )}
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="space-y-3" data-testid="today-routines">
        <h2 className="text-xl font-black">Routines</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No routines scheduled today.</p>
        ) : null}
        {runs.map((run) => (
          <Card key={run.id} className="border-2 border-pirate-wood/30">
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold">{run.name}</p>
                <StatusBadge status={run.status} />
              </div>
              <ul className="space-y-1.5">
                {run.steps.map((step) => (
                  <li
                    key={step.stepId}
                    className="flex items-center justify-between rounded-xl bg-white/50 px-3 py-2"
                  >
                    <span className={step.status === "DONE" ? "line-through opacity-60" : ""}>
                      {step.title}
                    </span>
                    {step.status === "DONE" ||
                    run.status === "SUBMITTED" ||
                    run.status === "APPROVED" ? (
                      <span aria-label="done">✅</span>
                    ) : (
                      <ActionForm action={completeRoutineStepAction} className="space-y-0">
                        <input type="hidden" name="runId" value={run.id} />
                        <input type="hidden" name="stepId" value={step.stepId} />
                        <SubmitButton
                          size="sm"
                          variant="secondary"
                          className="rounded-xl font-bold"
                        >
                          Done
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Finish every step to earn {run.bonusPoints} bonus points.
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
