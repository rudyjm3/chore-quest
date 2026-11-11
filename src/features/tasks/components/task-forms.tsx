"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { assignTaskAction, createTaskAction, updateAssignmentStatusAction } from "../actions";

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

export function ScheduleFields({ today }: { today: string }) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="frequency">Repeats</Label>
        <select id="frequency" name="frequency" className={select} defaultValue="DAILY">
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
              <input type="checkbox" name="daysOfWeek" value={i} className="size-4" /> {d}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="startDate">Start date</Label>
        <Input id="startDate" name="startDate" type="date" defaultValue={today} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="endDate">End date (optional)</Label>
        <Input id="endDate" name="endDate" type="date" />
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
