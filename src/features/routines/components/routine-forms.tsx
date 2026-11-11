"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScheduleFields } from "@/features/tasks/components/task-forms";

import { assignRoutineAction, createRoutineAction } from "../actions";

const select = "h-9 w-full rounded-md border bg-background px-3 text-sm";

export function CreateRoutineForm({
  templates,
  tasks,
}: {
  templates: Array<{ key: string; name: string; steps: Array<{ preset: { title: string } }> }>;
  tasks: Array<{ id: string; title: string }>;
}) {
  return (
    <ActionForm action={createRoutineAction} successMessage="Routine created">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="templateKey">Start from a template (optional)</Label>
          <select id="templateKey" name="templateKey" className={select} defaultValue="">
            <option value="">— build from my tasks —</option>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}: {t.steps.map((s) => s.preset.title).join(", ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Routine name</Label>
          <Input id="name" name="name" placeholder="Morning Routine" maxLength={80} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Steps (in order of selection)</Label>
          <div className="flex flex-wrap gap-3 text-sm">
            {tasks.map((t) => (
              <label key={t.id} className="flex items-center gap-1">
                <input type="checkbox" name="taskIds" value={t.id} className="size-4" /> {t.title}
              </label>
            ))}
            {tasks.length === 0 ? (
              <span className="text-muted-foreground">
                No tasks yet; a template will create them.
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <SubmitButton>Create routine</SubmitButton>
    </ActionForm>
  );
}

export function AssignRoutineForm({
  routines,
  childrenList,
  today,
}: {
  routines: Array<{ id: string; name: string }>;
  childrenList: Array<{ id: string; displayName: string }>;
  today: string;
}) {
  return (
    <ActionForm action={assignRoutineAction} successMessage="Routine assigned">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="routineId">Routine</Label>
          <select id="routineId" name="routineId" className={select} required>
            {routines.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="childId">Child</Label>
          <select id="childId" name="childId" className={select} required>
            {childrenList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
        <ScheduleFields today={today} />
        <div className="space-y-1.5">
          <Label htmlFor="bonusPoints">Bonus points for finishing</Label>
          <Input id="bonusPoints" name="bonusPoints" type="number" min={0} defaultValue={5} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="approvalPolicy">Approval</Label>
          <select
            id="approvalPolicy"
            name="approvalPolicy"
            className={select}
            defaultValue="PARENT_REVIEW"
          >
            <option value="PARENT_REVIEW">Parent reviews</option>
            <option value="AUTO_APPROVE">Auto-approve</option>
          </select>
        </div>
      </div>
      <SubmitButton disabled={routines.length === 0 || childrenList.length === 0}>
        Assign routine
      </SubmitButton>
    </ActionForm>
  );
}
