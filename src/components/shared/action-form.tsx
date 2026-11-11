"use client";

import { useActionState, useState, type ReactNode } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";

export type FormAction = (
  prev: ActionResult<unknown> | null,
  formData: FormData,
) => Promise<ActionResult<unknown>>;

/**
 * Small wrapper around `useActionState` for server-action forms: shows the
 * action's error (or a success toast) and remounts the form on success so
 * inputs reset. Feedback happens inside the action transition, not in an effect.
 */
export function ActionForm({
  action,
  children,
  successMessage,
  className,
  resetOnSuccess = true,
}: {
  action: FormAction;
  children: ReactNode;
  successMessage?: string;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [formKey, setFormKey] = useState(0);
  const [state, formAction] = useActionState<ActionResult<unknown> | null, FormData>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (result.ok) {
        if (successMessage) toast.success(successMessage);
        if (resetOnSuccess) setFormKey((k) => k + 1);
      } else {
        toast.error(result.error.message);
      }
      return result;
    },
    null,
  );

  return (
    <form
      action={formAction}
      className={cn("space-y-3", className)}
      key={formKey}
      data-testid="action-form"
    >
      {children}
      {state && !state.ok ? (
        <p className="text-sm text-danger" role="alert">
          {state.error.message}
          {state.error.details ? (
            <span className="block text-xs text-muted-foreground">
              {Object.entries(state.error.details)
                .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
                .join(" · ")}
            </span>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}
