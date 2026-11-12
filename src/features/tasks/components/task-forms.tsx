"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  addPresetAction,
  archiveTaskAction,
  assignTaskAction,
  createTaskAction,
  updateAssignmentAction,
  updateAssignmentStatusAction,
  updateTaskAction,
} from "../actions";

const CATEGORIES = ["CHORE", "HYGIENE", "SCHOOL", "PET_CARE", "HELPING", "OTHER"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const select = "h-9 w-full rounded-md border bg-background px-3 text-sm";

export function CreateTaskForm({
  presets,
}: {
  presets: Array<{ key: string; title: string; defaultPoints: number; category: string }>;
}) {
  return (
    <ActionForm action={createTaskAction} successMessage="Task created">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            list="preset-titles"
            required
            maxLength={80}
            placeholder="Make bed"
          />
          <datalist id="preset-titles">
            {presets.map((p) => (
              <option key={p.key} value={p.title} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <select id="category" name="category" className={select} defaultValue="CHORE">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="points">Points</Label>
          <Input id="points" name="points" type="number" min={0} max={10000} defaultValue={5} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="presetKey">From preset (optional)</Label>
          <select id="presetKey" name="presetKey" className={select} defaultValue="">
            <option value="">— custom task —</option>
            {presets.map((p) => (
              <option key={p.key} value={p.key}>
                {p.title} ({p.defaultPoints} pts)
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
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
      <SubmitButton>Create task</SubmitButton>
    </ActionForm>
  );
}

export interface ScheduleDefaults {
  frequency: string;
  daysOfWeek: number[];
  startDate: string;
  endDate: string | null;
}

export function ScheduleFields({
  today,
  defaults,
  idPrefix = "",
}: {
  today: string;
  defaults?: ScheduleDefaults;
  idPrefix?: string;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}frequency`}>Repeats</Label>
        <select
          id={`${idPrefix}frequency`}
          name="frequency"
          className={select}
          defaultValue={defaults?.frequency ?? "DAILY"}
        >
          <option value="DAILY">Every day</option>
          <option value="SPECIFIC_DAYS">Specific days</option>
          <option value="WEEKLY">Once a week</option>
          <option value="ONCE">Just once</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Days (for specific/weekly)</Label>
        <div className="flex flex-wrap gap-2 text-sm">
          {DAYS.map((d, i) => (
            <label key={d} className="flex items-center gap-1">
              <input
                type="checkbox"
                name="daysOfWeek"
                value={i}
                className="size-4"
                defaultChecked={defaults?.daysOfWeek.includes(i)}
              />{" "}
              {d}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}startDate`}>Start date</Label>
        <Input
          id={`${idPrefix}startDate`}
          name="startDate"
          type="date"
          defaultValue={defaults?.startDate ?? today}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}endDate`}>End date (optional)</Label>
        <Input
          id={`${idPrefix}endDate`}
          name="endDate"
          type="date"
          defaultValue={defaults?.endDate ?? ""}
        />
      </div>
    </>
  );
}

export function AssignTaskForm({
  tasks,
  childrenList,
  today,
}: {
  tasks: Array<{ id: string; title: string }>;
  childrenList: Array<{ id: string; displayName: string }>;
  today: string;
}) {
  return (
    <ActionForm action={assignTaskAction} successMessage="Task assigned">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="taskId">Task</Label>
          <select id="taskId" name="taskId" className={select} required>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
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
        <ScheduleFields today={today} />
        <div className="space-y-1.5">
          <Label htmlFor="dueTime">Due time (optional)</Label>
          <Input id="dueTime" name="dueTime" type="time" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pointsOverride">Points override (optional)</Label>
          <Input id="pointsOverride" name="pointsOverride" type="number" min={0} />
        </div>
      </div>
      <SubmitButton disabled={tasks.length === 0 || childrenList.length === 0}>Assign</SubmitButton>
    </ActionForm>
  );
}

export function AssignmentStatusButton({
  assignmentId,
  status,
}: {
  assignmentId: string;
  status: string;
}) {
  const next = status === "ACTIVE" ? "PAUSED" : "ACTIVE";
  if (status === "ARCHIVED") return null;
  return (
    <ActionForm action={updateAssignmentStatusAction} className="inline">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="status" value={next} />
      <SubmitButton size="sm" variant="ghost">
        {status === "ACTIVE" ? "Pause" : "Resume"}
      </SubmitButton>
    </ActionForm>
  );
}

export function ArchiveAssignmentButton({ assignmentId }: { assignmentId: string }) {
  return (
    <ActionForm action={updateAssignmentStatusAction} className="inline" successMessage="Archived">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="status" value="ARCHIVED" />
      <SubmitButton size="sm" variant="ghost">
        Archive
      </SubmitButton>
    </ActionForm>
  );
}

export function EditTaskForm({
  task,
}: {
  task: {
    id: string;
    title: string;
    description: string | null;
    category: string;
    points: number;
    approvalPolicy: string;
  };
}) {
  return (
    <ActionForm action={updateTaskAction} successMessage="Task updated" resetOnSuccess={false}>
      <input type="hidden" name="taskId" value={task.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`t-title-${task.id}`}>Title</Label>
          <Input
            id={`t-title-${task.id}`}
            name="title"
            defaultValue={task.title}
            required
            maxLength={80}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`t-cat-${task.id}`}>Category</Label>
          <select
            id={`t-cat-${task.id}`}
            name="category"
            className={select}
            defaultValue={task.category}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`t-pts-${task.id}`}>Points</Label>
          <Input
            id={`t-pts-${task.id}`}
            name="points"
            type="number"
            min={0}
            max={10000}
            defaultValue={task.points}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`t-appr-${task.id}`}>Approval</Label>
          <select
            id={`t-appr-${task.id}`}
            name="approvalPolicy"
            className={select}
            defaultValue={task.approvalPolicy}
          >
            <option value="PARENT_REVIEW">Parent reviews</option>
            <option value="AUTO_APPROVE">Auto-approve</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Changes apply to days generated from now on. Days already on the calendar keep their points.
      </p>
      <SubmitButton size="sm">Save task</SubmitButton>
    </ActionForm>
  );
}

export function ArchiveTaskButton({ taskId, archived }: { taskId: string; archived: boolean }) {
  return (
    <ActionForm
      action={archiveTaskAction}
      className="inline"
      successMessage={archived ? "Task archived" : "Task restored"}
    >
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="archived" value={archived ? "true" : "false"} />
      <SubmitButton size="sm" variant="ghost">
        {archived ? "Archive" : "Restore"}
      </SubmitButton>
    </ActionForm>
  );
}

export function AddPresetButton({ presetKey, label }: { presetKey: string; label: string }) {
  return (
    <ActionForm action={addPresetAction} className="inline" successMessage="Added to your library">
      <input type="hidden" name="presetKey" value={presetKey} />
      <SubmitButton size="sm" variant="outline" aria-label={`Add ${label} to library`}>
        Add
      </SubmitButton>
    </ActionForm>
  );
}

export function EditAssignmentForm({
  assignment,
  today,
}: {
  assignment: {
    id: string;
    frequency: string;
    daysOfWeek: number[];
    startDate: string;
    endDate: string | null;
    dueTime: string | null;
    pointsOverride: number | null;
    approvalPolicyOverride: string | null;
  };
  today: string;
}) {
  const prefix = `a-${assignment.id}-`;
  return (
    <ActionForm
      action={updateAssignmentAction}
      successMessage="Assignment updated"
      resetOnSuccess={false}
    >
      <input type="hidden" name="assignmentId" value={assignment.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <ScheduleFields today={today} defaults={assignment} idPrefix={prefix} />
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}dueTime`}>Due time (optional)</Label>
          <Input
            id={`${prefix}dueTime`}
            name="dueTime"
            type="time"
            defaultValue={assignment.dueTime ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}points`}>Points override (optional)</Label>
          <Input
            id={`${prefix}points`}
            name="pointsOverride"
            type="number"
            min={0}
            defaultValue={assignment.pointsOverride ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}appr`}>Approval</Label>
          <select
            id={`${prefix}appr`}
            name="approvalPolicyOverride"
            className={select}
            defaultValue={assignment.approvalPolicyOverride ?? ""}
          >
            <option value="">Use the task&apos;s setting</option>
            <option value="PARENT_REVIEW">Parent reviews</option>
            <option value="AUTO_APPROVE">Auto-approve</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Days already generated are not changed; edits apply to days created afterwards.
      </p>
      <SubmitButton size="sm">Save assignment</SubmitButton>
    </ActionForm>
  );
}
