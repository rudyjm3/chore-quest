"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  createChildAction,
  createFamilyAction,
  setChildPinAction,
  updateFamilySettingsAction,
} from "../actions";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function CreateFamilyForm() {
  return (
    <ActionForm action={createFamilyAction} resetOnSuccess={false}>
      <div className="space-y-1.5">
        <Label htmlFor="name">Family name</Label>
        <Input id="name" name="name" placeholder="The Smith Crew" required maxLength={80} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="timezone">Household timezone (IANA)</Label>
        <Input id="timezone" name="timezone" defaultValue={browserTimeZone()} required />
        <p className="text-xs text-muted-foreground">
          Used for daily chores, streaks and weekly goals.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="weekStartsOn">Week starts on</Label>
        <select
          id="weekStartsOn"
          name="weekStartsOn"
          defaultValue="1"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          {WEEKDAYS.map((day, i) => (
            <option key={day} value={i}>
              {day}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton className="w-full">Create family</SubmitButton>
    </ActionForm>
  );
}

export function AddChildForm() {
  return (
    <ActionForm action={createChildAction} successMessage="Child added">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Name or nickname</Label>
          <Input id="displayName" name="displayName" required maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pin">PIN (4–6 digits)</Label>
          <Input id="pin" name="pin" inputMode="numeric" pattern="\d{4,6}" placeholder="1234" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="birthYear">Birth year (optional)</Label>
          <Input
            id="birthYear"
            name="birthYear"
            type="number"
            min={new Date().getFullYear() - 18}
            max={new Date().getFullYear()}
          />
        </div>
      </div>
      <SubmitButton>Add child</SubmitButton>
    </ActionForm>
  );
}

export function SetPinForm({ childId }: { childId: string }) {
  return (
    <ActionForm
      action={setChildPinAction}
      successMessage="PIN updated"
      className="flex items-end gap-2"
    >
      <input type="hidden" name="childId" value={childId} />
      <div className="space-y-1">
        <Label htmlFor={`pin-${childId}`} className="text-xs">
          New PIN
        </Label>
        <Input
          id={`pin-${childId}`}
          name="pin"
          inputMode="numeric"
          pattern="\d{4,6}"
          className="h-8 w-28"
          required
        />
      </div>
      <SubmitButton size="sm" variant="outline">
        Set PIN
      </SubmitButton>
    </ActionForm>
  );
}

export function FamilySettingsForm({
  family,
}: {
  family: {
    name: string;
    timezone: string;
    weekStartsOn: number;
    defaultApprovalPolicy: string;
    allowChildSelfSignIn: boolean;
  };
}) {
  return (
    <ActionForm
      action={updateFamilySettingsAction}
      successMessage="Settings saved"
      resetOnSuccess={false}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Family name</Label>
          <Input id="name" name="name" defaultValue={family.name} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Input id="timezone" name="timezone" defaultValue={family.timezone} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="weekStartsOn">Week starts on</Label>
          <select
            id="weekStartsOn"
            name="weekStartsOn"
            defaultValue={String(family.weekStartsOn)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {WEEKDAYS.map((day, i) => (
              <option key={day} value={i}>
                {day}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="defaultApprovalPolicy">Default approval</Label>
          <select
            id="defaultApprovalPolicy"
            name="defaultApprovalPolicy"
            defaultValue={family.defaultApprovalPolicy}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="PARENT_REVIEW">Parent reviews each chore</option>
            <option value="AUTO_APPROVE">Auto-approve when a child marks done</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="allowChildSelfSignIn"
          defaultChecked={family.allowChildSelfSignIn}
          className="size-4"
        />
        Children may sign in on their own with the family code and PIN
      </label>
      <SubmitButton>Save settings</SubmitButton>
    </ActionForm>
  );
}
