"use client";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";

import { markChildNotificationsReadAction, markParentNotificationsReadAction } from "../actions";

export function MarkReadForm({ variant }: { variant: "parent" | "child" }) {
  return (
    <ActionForm
      action={
        variant === "parent" ? markParentNotificationsReadAction : markChildNotificationsReadAction
      }
      className="space-y-0"
      resetOnSuccess={false}
    >
      <SubmitButton size="sm" variant="outline" data-testid="mark-all-read">
        Mark all as read
      </SubmitButton>
    </ActionForm>
  );
}
