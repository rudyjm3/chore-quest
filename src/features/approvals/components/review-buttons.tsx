"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";

import { reviewOccurrenceAction, reviewRoutineRunAction } from "../actions";

export function ReviewOccurrenceButtons({ occurrenceId }: { occurrenceId: string }) {
  return (
    <div className="flex gap-2">
      <ActionForm
        action={reviewOccurrenceAction}
        successMessage="Approved! Rewards and progress updated."
        className="space-y-0"
      >
        <input type="hidden" name="occurrenceId" value={occurrenceId} />
        <input type="hidden" name="decision" value="APPROVED" />
        <SubmitButton size="sm" data-testid="approve-button">
          Approve
        </SubmitButton>
      </ActionForm>
      <ActionForm
        action={reviewOccurrenceAction}
        successMessage="Sent back to try again."
        className="space-y-0"
      >
        <input type="hidden" name="occurrenceId" value={occurrenceId} />
        <input type="hidden" name="decision" value="REJECTED" />
        <SubmitButton size="sm" variant="outline" data-testid="reject-button">
          Try again
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

export function ReviewRoutineRunButtons({ runId }: { runId: string }) {
  return (
    <div className="flex gap-2">
      <ActionForm
        action={reviewRoutineRunAction}
        successMessage="Routine approved!"
        className="space-y-0"
      >
        <input type="hidden" name="runId" value={runId} />
        <input type="hidden" name="decision" value="APPROVED" />
        <SubmitButton size="sm">Approve</SubmitButton>
      </ActionForm>
      <ActionForm action={reviewRoutineRunAction} successMessage="Sent back." className="space-y-0">
        <input type="hidden" name="runId" value={runId} />
        <input type="hidden" name="decision" value="REJECTED" />
        <SubmitButton size="sm" variant="outline">
          Try again
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
