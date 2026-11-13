"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  repairGoalAction,
  setGoalArchivedAction,
  updateGoalAction,
  updateGoalAssignmentAction,
} from "../actions";

export interface EditableGoal {
  id: string;
  title: string;
  description: string | null;
  targetCount: number;
  rewardPoints: number;
  rewardDescription: string | null;
  type: string;
  recurrence: string;
}

const RESET_RULES: Record<string, string> = {
  WEEKLY: "Resets every week: each week is a fresh count.",
  NONE: "Does not reset: it keeps counting until it is reached or its end date passes.",
};

export function EditGoalForm({ goal }: { goal: EditableGoal }) {
  return (
    <ActionForm action={updateGoalAction} successMessage="Goal updated" resetOnSuccess={false}>
      <input type="hidden" name="goalId" value={goal.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`title-${goal.id}`}>Title</Label>
          <Input
            id={`title-${goal.id}`}
            name="title"
            defaultValue={goal.title}
            required
            maxLength={80}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`desc-${goal.id}`}>Description (optional)</Label>
          <Input
            id={`desc-${goal.id}`}
            name="description"
            defaultValue={goal.description ?? ""}
            maxLength={1000}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`target-${goal.id}`}>Target</Label>
          <Input
            id={`target-${goal.id}`}
            name="targetCount"
            type="number"
            min={1}
            defaultValue={goal.targetCount}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`reward-${goal.id}`}>Reward points</Label>
          <Input
            id={`reward-${goal.id}`}
            name="rewardPoints"
            type="number"
            min={0}
            defaultValue={goal.rewardPoints}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`rewarddesc-${goal.id}`}>Reward note (optional)</Label>
          <Input
            id={`rewarddesc-${goal.id}`}
            name="rewardDescription"
            defaultValue={goal.rewardDescription ?? ""}
            maxLength={200}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {RESET_RULES[goal.recurrence] ?? RESET_RULES.NONE} The goal type and which chores count are
        fixed once created; to change them, archive this goal and make a new one. Lowering the
        target below a child&apos;s progress completes their goal. Reward changes only affect goals
        reached afterwards.
      </p>
      <SubmitButton size="sm">Save changes</SubmitButton>
    </ActionForm>
  );
}

export function ArchiveGoalButton({ goalId, archived }: { goalId: string; archived: boolean }) {
  return (
    <ActionForm
      action={setGoalArchivedAction}
      successMessage={archived ? "Goal restored" : "Goal archived"}
      className="space-y-0"
    >
      <input type="hidden" name="goalId" value={goalId} />
      <input type="hidden" name="archived" value={archived ? "false" : "true"} />
      <SubmitButton size="sm" variant="outline">
        {archived ? "Restore goal" : "Archive goal"}
      </SubmitButton>
    </ActionForm>
  );
}

export function RepairGoalButton({ goalId }: { goalId: string }) {
  return (
    <ActionForm
      action={repairGoalAction}
      successMessage="Progress recalculated from completions"
      className="space-y-0"
      resetOnSuccess={false}
    >
      <input type="hidden" name="goalId" value={goalId} />
      <SubmitButton size="sm" variant="ghost">
        Recalculate progress
      </SubmitButton>
    </ActionForm>
  );
}

export function EditAssignmentForm({
  assignment,
  goalTarget,
}: {
  assignment: {
    id: string;
    childName: string;
    startDate: string;
    endDate: string | null;
    targetOverride: number | null;
    weekly: boolean;
    status: string;
  };
  goalTarget: number;
}) {
  const label = (field: string) => `${field}-${assignment.id}`;
  return (
    <ActionForm
      action={updateGoalAssignmentAction}
      successMessage="Assignment updated"
      resetOnSuccess={false}
    >
      <input type="hidden" name="assignmentId" value={assignment.id} />
      <p className="text-sm font-medium">
        {assignment.childName}{" "}
        <span className="font-normal text-muted-foreground">
          ({assignment.status.toLowerCase()})
        </span>
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={label("start")}>Starts</Label>
          <Input
            id={label("start")}
            name="startDate"
            type="date"
            defaultValue={assignment.startDate}
            disabled={assignment.weekly}
            required={!assignment.weekly}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={label("end")}>Ends (optional)</Label>
          <Input
            id={label("end")}
            name="endDate"
            type="date"
            defaultValue={assignment.endDate ?? ""}
            disabled={assignment.weekly}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={label("target")}>Target for this child</Label>
          <Input
            id={label("target")}
            name="targetCount"
            type="number"
            min={1}
            placeholder={`Same as goal (${goalTarget})`}
            defaultValue={assignment.targetOverride ?? ""}
          />
        </div>
      </div>
      {assignment.weekly ? (
        <p className="text-xs text-muted-foreground">
          Weekly goals follow the calendar week, so the dates are fixed. A target set here applies
          to this week only.
        </p>
      ) : null}
      <SubmitButton size="sm" variant="outline">
        Save assignment
      </SubmitButton>
    </ActionForm>
  );
}
