"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";

import { requestRedemptionAction } from "../actions";

export function RequestRewardButton({
  rewardId,
  disabledReason,
}: {
  rewardId: string;
  disabledReason: string | null;
}) {
  return (
    <ActionForm
      action={requestRedemptionAction}
      successMessage="Asked! A grown-up will check. Your points are saved for it."
      className="space-y-1"
    >
      <input type="hidden" name="rewardDefinitionId" value={rewardId} />
      <SubmitButton
        className="h-12 rounded-2xl px-5 text-base font-black"
        disabled={disabledReason !== null}
        data-testid="request-reward"
      >
        I want this!
      </SubmitButton>
      {disabledReason ? <p className="text-sm text-muted-foreground">{disabledReason}</p> : null}
    </ActionForm>
  );
}
