"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";

import { claimChapterRewardAction, startAdventureAction } from "../actions";

export function StartAdventureButton({ adventureKey }: { adventureKey: string }) {
  return (
    <ActionForm
      action={startAdventureAction}
      successMessage="Welcome aboard, captain!"
      className="space-y-0"
    >
      <input type="hidden" name="adventureKey" value={adventureKey} />
      <SubmitButton
        className="h-14 rounded-2xl px-8 text-lg font-black"
        data-testid="start-adventure"
      >
        Begin the adventure
      </SubmitButton>
    </ActionForm>
  );
}

export function ClaimChapterRewardButton({ chapterId }: { chapterId: string }) {
  return (
    <ActionForm
      action={claimChapterRewardAction}
      successMessage="Treasure claimed!"
      className="space-y-0"
    >
      <input type="hidden" name="chapterId" value={chapterId} />
      <SubmitButton
        className="h-12 rounded-2xl px-6 text-base font-black"
        data-testid="claim-reward"
      >
        Claim chapter reward
      </SubmitButton>
    </ActionForm>
  );
}
