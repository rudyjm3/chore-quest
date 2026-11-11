"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { assignGoalAction, createGoalAction } from "../actions";

const select = "h-9 w-full rounded-md border bg-background px-3 text-sm";

export function CreateGoalForm({
  tasks,
  routines,
}: {
  tasks: Array<{ id: string; title: string }>;
  routines: Array<{ id: string; name: string }>;
}) {
  return (
    <ActionForm action={createGoalAction} successMessage="Goal created">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            placeholder="Make your bed 5 times this week"
            required
            maxLength={80}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <select id="type" name="type" className={select} defaultValue="WEEKLY_COUNT">
            <option value="TOTAL_COUNT">Total completions</option>
            <option value="WEEKLY_COUNT">Completions this week</option>
            <option value="CONSECUTIVE_DAYS">Consecutive days (streak)</option>
            <option value="ROUTINE_CONSISTENCY">Routine consistency</option>
            <option value="CUSTOM_MILESTONE">Custom milestone</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="targetCount">Target</Label>
          <Input
            id="targetCount"
            name="targetCount"
            type="number"
            min={1}
            defaultValue={5}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="recurrence">Repeat</Label>
          <select id="recurrence" name="recurrence" className={select} defaultValue="NONE">
            <option value="NONE">One time</option>
            <option value="WEEKLY">Every week (weekly goals only)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rewardPoints">Reward points</Label>
          <Input id="rewardPoints" name="rewardPoints" type="number" min={0} defaultValue={0} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filterTaskId">Only this task (optional)</Label>
          <select id="filterTaskId" name="filterTaskId" className={select} defaultValue="">
            <option value="">Any task</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filterRoutineId">Only this routine (optional)</Label>
          <select id="filterRoutineId" name="filterRoutineId" className={select} defaultValue="">
            <option value="">Any routine</option>
            {routines.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <SubmitButton>Create goal</SubmitButton>
    </ActionForm>
  );
}

export function AssignGoalForm({
  goals,
  childrenList,
  today,
}: {
  goals: Array<{ id: string; title: string }>;
  childrenList: Array<{ id: string; displayName: string }>;
  today: string;
}) {
  return (
    <ActionForm action={assignGoalAction} successMessage="Goal assigned">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="goalId">Goal</Label>
          <select id="goalId" name="goalId" className={select} required>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Children</Label>
          <div className="flex flex-wrap gap-3 text-sm">
            {childrenList.map((c) => (
              <label key={c.id} className="flex items-center gap-1">
                <input type="checkbox" name="childIds" value={c.id} className="size-4" />{" "}
                {c.displayName}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={today} required />
        </div>
      </div>
      <SubmitButton disabled={goals.length === 0 || childrenList.length === 0}>
        Assign goal
      </SubmitButton>
    </ActionForm>
  );
}
