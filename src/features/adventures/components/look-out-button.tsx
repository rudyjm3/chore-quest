"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";

import { lookOutAction } from "../actions";

export function LookOutButton() {
  return (
    <ActionForm action={lookOutAction} resetOnSuccess={false} className="flex justify-center">
      <SubmitButton
        className="min-h-12 rounded-2xl px-6 text-base font-black"
        pendingText="Looking…"
        data-testid="look-out"
      >
        🔭 Look out to sea
      </SubmitButton>
    </ActionForm>
  );
}
