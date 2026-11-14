"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { equipCosmeticAction } from "@/features/adventures/actions";

/** Wear or take off one item. `itemKey` empty means "take off this slot". */
export function EquipButton({
  slot,
  itemKey,
  itemName,
  worn,
}: {
  slot: string;
  itemKey: string;
  itemName: string;
  worn: boolean;
}) {
  return (
    <ActionForm
      action={equipCosmeticAction}
      successMessage={worn ? `${itemName} is back in your chest` : `You are wearing ${itemName}!`}
      resetOnSuccess={false}
      className="space-y-1"
    >
      <input type="hidden" name="slot" value={slot} />
      <input type="hidden" name="itemKey" value={worn ? "" : itemKey} />
      <SubmitButton
        className="min-h-12 rounded-2xl px-5 text-base font-black"
        variant={worn ? "outline" : "default"}
        pendingText="One moment…"
        aria-label={worn ? `Take off ${itemName}` : `Wear ${itemName}`}
        data-testid={`${worn ? "unequip" : "equip"}-${itemKey}`}
      >
        {worn ? "Take off" : "Wear it"}
      </SubmitButton>
    </ActionForm>
  );
}
