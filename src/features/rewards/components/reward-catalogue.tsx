"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  createRewardAction,
  resolveRedemptionAction,
  setRewardActiveAction,
  updateRewardAction,
} from "../actions";

export interface RewardFormValues {
  id?: string;
  title: string;
  description: string | null;
  costPoints: number;
  stock: number | null;
}

export function RewardForm({ reward }: { reward?: RewardFormValues }) {
  const id = reward?.id ?? "new";
  return (
    <ActionForm
      action={reward ? updateRewardAction : createRewardAction}
      successMessage={reward ? "Reward updated" : "Reward added"}
      resetOnSuccess={!reward}
    >
      {reward ? <input type="hidden" name="rewardId" value={reward.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`reward-title-${id}`}>Reward</Label>
          <Input
            id={`reward-title-${id}`}
            name="title"
            required
            maxLength={80}
            defaultValue={reward?.title}
            placeholder="Movie night"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`reward-cost-${id}`}>Price (points)</Label>
          <Input
            id={`reward-cost-${id}`}
            name="costPoints"
            type="number"
            min={1}
            max={10000}
            required
            defaultValue={reward?.costPoints ?? 50}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`reward-stock-${id}`}>How many (optional)</Label>
          <Input
            id={`reward-stock-${id}`}
            name="stock"
            type="number"
            min={0}
            placeholder="Unlimited"
            defaultValue={reward?.stock ?? ""}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-4">
          <Label htmlFor={`reward-desc-${id}`}>Description (optional)</Label>
          <Input
            id={`reward-desc-${id}`}
            name="description"
            maxLength={1000}
            defaultValue={reward?.description ?? ""}
          />
        </div>
      </div>
      <SubmitButton size="sm">{reward ? "Save reward" : "Add reward"}</SubmitButton>
    </ActionForm>
  );
}

export function ArchiveRewardButton({ rewardId, active }: { rewardId: string; active: boolean }) {
  return (
    <ActionForm
      action={setRewardActiveAction}
      successMessage={active ? "Reward archived" : "Reward restored"}
      className="space-y-0"
    >
      <input type="hidden" name="rewardId" value={rewardId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <SubmitButton size="sm" variant="outline">
        {active ? "Archive" : "Restore"}
      </SubmitButton>
    </ActionForm>
  );
}

/** Approve / decline a request, or mark an approved one as given. The note is shown to the child. */
export function ResolveRedemptionForm({
  redemptionId,
  status,
}: {
  redemptionId: string;
  status: "REQUESTED" | "APPROVED";
}) {
  return (
    <ActionForm
      action={resolveRedemptionAction}
      successMessage="Saved. The child will be notified."
      className="space-y-0"
    >
      <input type="hidden" name="redemptionId" value={redemptionId} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor={`redeem-note-${redemptionId}`}>
          Note for the child (optional)
        </label>
        <Input
          id={`redeem-note-${redemptionId}`}
          name="note"
          maxLength={300}
          placeholder="Note for the child (optional)"
          className="sm:w-56"
        />
        <div className="flex gap-2">
          {status === "REQUESTED" ? (
            <>
              <SubmitButton size="sm" name="decision" value="APPROVED" data-testid="redeem-approve">
                Approve
              </SubmitButton>
              <SubmitButton
                size="sm"
                variant="outline"
                name="decision"
                value="DENIED"
                data-testid="redeem-deny"
              >
                Decline and refund
              </SubmitButton>
            </>
          ) : (
            <SubmitButton size="sm" name="decision" value="FULFILLED" data-testid="redeem-fulfill">
              Mark as given
            </SubmitButton>
          )}
        </div>
      </div>
    </ActionForm>
  );
}
