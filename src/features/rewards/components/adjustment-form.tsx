"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { parentAdjustmentAction } from "../actions";

/** `idempotencyKey` is generated server-side per page render so a double submit cannot double-adjust. */
export function AdjustmentForm({
  childrenList,
  idempotencyKey,
}: {
  childrenList: Array<{ id: string; displayName: string }>;
  idempotencyKey: string;
}) {
  return (
    <ActionForm action={parentAdjustmentAction} successMessage="Adjustment recorded">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="childId">Child</Label>
          <select
            id="childId"
            name="childId"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            required
          >
            {childrenList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency</Label>
          <select
            id="currency"
            name="currency"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue="POINTS"
          >
            <option value="POINTS">Points</option>
            <option value="COINS">Coins</option>
            <option value="XP">XP</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="amount">Amount (+/−)</Label>
          <Input id="amount" name="amount" type="number" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason</Label>
          <Input
            id="reason"
            name="reason"
            required
            maxLength={200}
            placeholder="Bonus for helping grandma"
          />
        </div>
      </div>
      <SubmitButton disabled={childrenList.length === 0}>Record adjustment</SubmitButton>
    </ActionForm>
  );
}
