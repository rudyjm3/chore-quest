"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { visitLocationAction } from "@/features/adventures/actions";

export function VisitLocationButton({
  chapterKey,
  locationKey,
  label,
  successMessage,
}: {
  chapterKey: string;
  locationKey: string;
  label: string;
  successMessage: string;
}) {
  return (
    <ActionForm action={visitLocationAction} successMessage={successMessage} resetOnSuccess={false}>
      <input type="hidden" name="chapterKey" value={chapterKey} />
      <input type="hidden" name="locationKey" value={locationKey} />
      <SubmitButton
        className="min-h-12 rounded-2xl px-6 text-base font-black"
        pendingText="Looking…"
        data-testid="visit-location"
      >
        {label}
      </SubmitButton>
    </ActionForm>
  );
}
