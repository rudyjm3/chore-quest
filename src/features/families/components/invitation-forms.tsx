"use client";

import { useActionState } from "react";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";

import {
  acceptInvitationAction,
  createInvitationAction,
  removeGuardianAction,
  revokeInvitationAction,
} from "../invitation-actions";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action] = useActionState<ActionResult<unknown> | null, FormData>(
    acceptInvitationAction,
    null,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="token" value={token} />
      <SubmitButton className="w-full">Accept invitation</SubmitButton>
      {state && !state.ok ? (
        <p className="text-sm text-danger" role="alert">
          {state.error.message}
        </p>
      ) : null}
    </form>
  );
}

export function InviteGuardianForm() {
  const [state, action] = useActionState<ActionResult<unknown> | null, FormData>(
    createInvitationAction,
    null,
  );
  const result = state && state.ok ? (state.data as { url: string; emailSent: boolean }) : null;
  return (
    <form action={action} className="space-y-3" data-testid="invite-form">
      <div className="space-y-1.5">
        <Label htmlFor="invite-email">Email address</Label>
        <Input id="invite-email" name="email" type="email" required autoComplete="off" />
      </div>
      <SubmitButton size="sm">Send invitation</SubmitButton>
      {state && !state.ok ? (
        <p className="text-sm text-danger" role="alert">
          {state.error.message}
        </p>
      ) : null}
      {result ? (
        <div className="space-y-1 rounded-lg border bg-muted p-3 text-sm" role="status">
          <p>
            {result.emailSent
              ? "Invitation created. We emailed the link; you can also share it yourself. It is shown only once:"
              : "Invitation created, but the email could not be sent. Share this link yourself (shown only once):"}
          </p>
          <code className="block break-all" data-testid="invite-link">
            {result.url}
          </code>
        </div>
      ) : null}
    </form>
  );
}

export function RevokeInvitationButton({ invitationId }: { invitationId: string }) {
  return (
    <ActionForm
      action={revokeInvitationAction}
      className="inline"
      successMessage="Invitation revoked"
    >
      <input type="hidden" name="invitationId" value={invitationId} />
      <SubmitButton size="sm" variant="ghost">
        Revoke
      </SubmitButton>
    </ActionForm>
  );
}

export function RemoveGuardianButton({ memberId, name }: { memberId: string; name: string }) {
  return (
    <ActionForm action={removeGuardianAction} className="inline" successMessage="Guardian removed">
      <input type="hidden" name="memberId" value={memberId} />
      <SubmitButton size="sm" variant="ghost" aria-label={`Remove ${name}`}>
        Remove
      </SubmitButton>
    </ActionForm>
  );
}
