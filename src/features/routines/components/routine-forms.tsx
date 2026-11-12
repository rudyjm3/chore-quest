"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScheduleFields } from "@/features/tasks/components/task-forms";

import {
  archiveRoutineAction,
  assignRoutineAction,
  createRoutineAction,
  moveRoutineStepAction,
  routineAssignmentStatusAction,
  setStepOptionalAction,
  updateRoutineAction,
  updateRoutineAssignmentAction,
} from "../actions";

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
        <WindowFields />
      </div>
      <SubmitButton disabled={routines.length === 0 || childrenList.length === 0}>
        Assign routine
      </SubmitButton>
    </ActionForm>
  );
}

export function WindowFields({
  start,
  end,
  idPrefix = "",
}: {
  start?: string | null;
  end?: string | null;
  idPrefix?: string;
}) {
  return (
    <fieldset className="space-y-1.5 sm:col-span-2">
      <legend className="text-sm font-medium">Completion window (optional, household time)</legend>
      <div className="flex gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}windowStart`} className="text-xs">
            Opens
          </Label>
          <Input
            id={`${idPrefix}windowStart`}
            name="windowStart"
            type="time"
            defaultValue={start ?? ""}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}windowEnd`} className="text-xs">
            Closes
          </Label>
          <Input
            id={`${idPrefix}windowEnd`}
            name="windowEnd"
            type="time"
            defaultValue={end ?? ""}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Children can only tick steps inside this window. Leave both empty for any time that day.
      </p>
    </fieldset>
  );
}

export function EditRoutineForm({
  routine,
}: {
  routine: { id: string; name: string; description: string | null };
}) {
  return (
    <ActionForm
      action={updateRoutineAction}
      successMessage="Routine updated"
      resetOnSuccess={false}
    >
      <input type="hidden" name="routineId" value={routine.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`rn-${routine.id}`}>Name</Label>
          <Input
            id={`rn-${routine.id}`}
            name="name"
            defaultValue={routine.name}
            required
            maxLength={80}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`rd-${routine.id}`}>Description</Label>
          <Input
            id={`rd-${routine.id}`}
            name="description"
            defaultValue={routine.description ?? ""}
          />
        </div>
      </div>
      <SubmitButton size="sm">Save routine</SubmitButton>
    </ActionForm>
  );
}

export function StepControls({
  routineId,
  stepId,
  title,
  isOptional,
  isFirst,
  isLast,
}: {
  routineId: string;
  stepId: string;
  title: string;
  isOptional: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <span className="flex items-center gap-1">
      {(["up", "down"] as const).map((direction) => (
        <ActionForm key={direction} action={moveRoutineStepAction} className="inline">
          <input type="hidden" name="routineId" value={routineId} />
          <input type="hidden" name="stepId" value={stepId} />
          <input type="hidden" name="direction" value={direction} />
          <SubmitButton
            size="sm"
            variant="ghost"
            pendingText="…"
            disabled={direction === "up" ? isFirst : isLast}
            aria-label={`Move ${title} ${direction}`}
          >
            {direction === "up" ? "↑" : "↓"}
          </SubmitButton>
        </ActionForm>
      ))}
      <ActionForm action={setStepOptionalAction} className="inline" resetOnSuccess={false}>
        <input type="hidden" name="routineId" value={routineId} />
        <input type="hidden" name="stepId" value={stepId} />
        <input type="hidden" name="isOptional" value={isOptional ? "false" : "true"} />
        <SubmitButton
          size="sm"
          variant="outline"
          aria-label={`Make ${title} ${isOptional ? "required" : "optional"}`}
        >
          {isOptional ? "Optional" : "Required"}
        </SubmitButton>
      </ActionForm>
    </span>
  );
}

export function ArchiveRoutineButton({
  routineId,
  archived,
}: {
  routineId: string;
  archived: boolean;
}) {
  return (
    <ActionForm
      action={archiveRoutineAction}
      className="inline"
      successMessage={archived ? "Routine archived" : "Routine restored"}
    >
      <input type="hidden" name="routineId" value={routineId} />
      <input type="hidden" name="archived" value={archived ? "true" : "false"} />
      <SubmitButton size="sm" variant="ghost">
        {archived ? "Archive routine" : "Restore"}
      </SubmitButton>
    </ActionForm>
  );
}

export function EditRoutineAssignmentForm({
  assignment,
  today,
}: {
  assignment: {
    id: string;
    frequency: string;
    daysOfWeek: number[];
    startDate: string;
    endDate: string | null;
    bonusPoints: number;
    approvalPolicy: string;
    windowStart: string | null;
    windowEnd: string | null;
  };
  today: string;
}) {
  const prefix = `ra-${assignment.id}-`;
  return (
    <ActionForm
      action={updateRoutineAssignmentAction}
      successMessage="Assignment updated"
      resetOnSuccess={false}
    >
      <input type="hidden" name="assignmentId" value={assignment.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <ScheduleFields today={today} defaults={assignment} idPrefix={prefix} />
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}bonus`}>Bonus points</Label>
          <Input
            id={`${prefix}bonus`}
            name="bonusPoints"
            type="number"
            min={0}
            defaultValue={assignment.bonusPoints}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}appr`}>Approval</Label>
          <select
            id={`${prefix}appr`}
            name="approvalPolicy"
            className={select}
            defaultValue={assignment.approvalPolicy}
          >
            <option value="PARENT_REVIEW">Parent reviews</option>
            <option value="AUTO_APPROVE">Auto-approve</option>
          </select>
        </div>
        <WindowFields start={assignment.windowStart} end={assignment.windowEnd} idPrefix={prefix} />
      </div>
      <SubmitButton size="sm">Save assignment</SubmitButton>
    </ActionForm>
  );
}

export function RoutineAssignmentStatusButtons({
  assignmentId,
  status,
}: {
  assignmentId: string;
  status: string;
}) {
  return (
    <span className="flex gap-1">
      {status !== "ARCHIVED" ? (
        <ActionForm action={routineAssignmentStatusAction} className="inline">
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <input type="hidden" name="status" value={status === "ACTIVE" ? "PAUSED" : "ACTIVE"} />
          <SubmitButton size="sm" variant="ghost">
            {status === "ACTIVE" ? "Pause" : "Resume"}
          </SubmitButton>
        </ActionForm>
      ) : null}
      {status !== "ARCHIVED" ? (
        <ActionForm action={routineAssignmentStatusAction} className="inline">
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <input type="hidden" name="status" value="ARCHIVED" />
          <SubmitButton size="sm" variant="ghost">
            Archive
          </SubmitButton>
        </ActionForm>
      ) : null}
    </span>
  );
}
