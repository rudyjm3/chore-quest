"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { AVATARS } from "@/lib/avatars";

import {
  archiveChildAction,
  createChildAction,
  createFamilyAction,
  restoreChildAction,
  rotateFamilyCodeAction,
  setChildPinAction,
  updateChildProfileAction,
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
        <div className="space-y-1.5 sm:col-span-3">
          <AvatarPicker />
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
      successMessage="PIN reset. The child was signed out everywhere."
      className="flex flex-wrap items-end gap-2"
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
          autoComplete="off"
          pattern="\d{4,6}"
          className="h-8 w-24"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`confirm-${childId}`} className="text-xs">
          Confirm PIN
        </Label>
        <Input
          id={`confirm-${childId}`}
          name="confirmPin"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d{4,6}"
          className="h-8 w-24"
          required
        />
      </div>
      <SubmitButton size="sm" variant="outline">
        Reset PIN
      </SubmitButton>
    </ActionForm>
  );
}

export function AvatarPicker({
  name = "avatarKey",
  current,
}: {
  name?: string;
  current?: string | null;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">Avatar</legend>
      <div className="flex flex-wrap gap-2">
        {AVATARS.map((a) => (
          <label
            key={a.key}
            className="flex size-11 cursor-pointer items-center justify-center rounded-lg border text-2xl has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-2"
            title={a.label}
          >
            <input
              type="radio"
              name={name}
              value={a.key}
              defaultChecked={current === a.key}
              className="sr-only"
              aria-label={a.label}
            />
            <span aria-hidden>{a.glyph}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function EditChildForm({
  child,
}: {
  child: { id: string; displayName: string; avatarKey: string | null };
}) {
  return (
    <ActionForm
      action={updateChildProfileAction}
      successMessage="Profile saved"
      resetOnSuccess={false}
    >
      <input type="hidden" name="childId" value={child.id} />
      <div className="space-y-1.5">
        <Label htmlFor={`name-${child.id}`}>Name or nickname</Label>
        <Input
          id={`name-${child.id}`}
          name="displayName"
          defaultValue={child.displayName}
          required
          maxLength={80}
        />
      </div>
      <AvatarPicker current={child.avatarKey} />
      <SubmitButton size="sm">Save profile</SubmitButton>
    </ActionForm>
  );
}

export function ArchiveChildButton({ childId, name }: { childId: string; name: string }) {
  return (
    <ActionForm action={archiveChildAction} className="inline" successMessage="Child archived">
      <input type="hidden" name="childId" value={childId} />
      <SubmitButton size="sm" variant="ghost" aria-label={`Archive ${name}`}>
        Archive
      </SubmitButton>
    </ActionForm>
  );
}

export function RestoreChildButton({ childId, name }: { childId: string; name: string }) {
  return (
    <ActionForm action={restoreChildAction} className="inline" successMessage="Child restored">
      <input type="hidden" name="childId" value={childId} />
      <SubmitButton size="sm" variant="outline" aria-label={`Restore ${name}`}>
        Restore
      </SubmitButton>
    </ActionForm>
  );
}

export function RotateFamilyCodeForm() {
  return (
    <ActionForm
      action={rotateFamilyCodeAction}
      successMessage="New family code created. Share it with your children."
      resetOnSuccess={false}
    >
      <p className="text-sm text-muted-foreground">
        If the code was shared by mistake, create a new one. The old code stops working right away;
        children who are already signed in stay signed in.
      </p>
      <SubmitButton size="sm" variant="outline">
        Create a new family code
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
