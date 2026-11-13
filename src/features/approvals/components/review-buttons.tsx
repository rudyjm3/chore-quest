"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/errors";

import { reviewOccurrenceAction, reviewRoutineRunAction } from "../actions";

type ReviewAction = (
  prev: ActionResult<unknown> | null,
  formData: FormData,
) => Promise<ActionResult<unknown>>;

/**
 * One form per item: an optional note for the child plus Approve / Try again. The clicked
 * button's name/value carries the decision, so the note is sent with either choice.
 */
function ReviewForm({
  action,
  idName,
  id,
  approveTestId,
  rejectTestId,
}: {
  action: ReviewAction;
  idName: "occurrenceId" | "runId";
  id: string;
  approveTestId?: string;
  rejectTestId?: string;
}) {
  return (
    <ActionForm
      action={action}
      successMessage="Saved. The child will be notified."
      className="space-y-0"
    >
      <input type="hidden" name={idName} value={id} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor={`note-${id}`}>
          Note for the child (optional)
        </label>
        <Input
          id={`note-${id}`}
          name="note"
          maxLength={300}
          placeholder="Note for the child (optional)"
          className="sm:w-56"
        />
        <div className="flex gap-2">
          <SubmitButton size="sm" name="decision" value="APPROVED" data-testid={approveTestId}>
            Approve
          </SubmitButton>
          <SubmitButton
            size="sm"
            variant="outline"
            name="decision"
            value="REJECTED"
            data-testid={rejectTestId}
          >
            Try again
          </SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}

export function ReviewOccurrenceButtons({ occurrenceId }: { occurrenceId: string }) {
  return (
    <ReviewForm
      action={reviewOccurrenceAction}
      idName="occurrenceId"
      id={occurrenceId}
      approveTestId="approve-button"
      rejectTestId="reject-button"
    />
  );
}

export function ReviewRoutineRunButtons({ runId }: { runId: string }) {
  return (
    <ReviewForm
      action={reviewRoutineRunAction}
      idName="runId"
      id={runId}
      approveTestId="approve-routine-button"
    />
  );
}
