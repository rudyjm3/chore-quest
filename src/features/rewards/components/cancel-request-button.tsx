"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";

import { cancelRedemptionAction } from "../actions";

export function CancelRequestButton({
  redemptionId,
  title,
}: {
  redemptionId: string;
  title: string;
}) {
  return (
    <ActionForm
      action={cancelRedemptionAction}
      successMessage="Request cancelled. Your points are back!"
      className="inline"
    >
      <input type="hidden" name="redemptionId" value={redemptionId} />
      <SubmitButton
        variant="outline"
        className="min-h-11 rounded-xl px-4 text-sm font-bold"
        pendingText="Cancelling…"
        aria-label={`Cancel my request for ${title}`}
        data-testid="cancel-request"
      >
        Cancel request
      </SubmitButton>
    </ActionForm>
  );
}
