"use client";

import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/errors";
import type { BulkApprovalResult } from "@/server/services/approval.service";

import { bulkApproveAction } from "../actions";

export interface BulkItem {
  /** "occurrence:<id>" or "routine_run:<id>" */
  value: string;
  title: string;
  detail: string;
}

type BulkState = ActionResult<{ results: BulkApprovalResult[] }> | null;

/**
 * Tick several submissions and approve them in one go. The server processes every item in its own
 * transaction and returns a result per item, so a failure on one row is shown next to that row
 * instead of blocking the rest.
 */
export function BulkApproveForm({ items }: { items: BulkItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction] = useActionState<BulkState, FormData>(
    async (prev, formData) => (await bulkApproveAction(prev, formData)) as BulkState,
    null,
  );
  const results = state?.ok ? state.data.results : [];
  const failed = results.filter((r) => !r.ok);
  const allSelected = items.length > 0 && selected.size === items.length;

  function toggle(value: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-3" data-testid="bulk-approve">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() =>
              setSelected(allSelected ? new Set() : new Set(items.map((i) => i.value)))
            }
            aria-label="Select all submissions"
          />
          Select all ({items.length})
        </label>
        <label className="sr-only" htmlFor="bulk-note">
          Note for the children (optional)
        </label>
        <Input
          id="bulk-note"
          name="note"
          maxLength={300}
          placeholder="Note for the children (optional)"
          className="w-64"
        />
        <SubmitButton size="sm" disabled={selected.size === 0} data-testid="bulk-approve-button">
          Approve selected ({selected.size})
        </SubmitButton>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {items.map((item) => {
          const result = results.find((r) => `${r.kind}:${r.id}` === item.value);
          return (
            <li key={item.value} className="flex items-center gap-3 px-4 py-2 text-sm">
              <input
                type="checkbox"
                name="items"
                value={item.value}
                checked={selected.has(item.value)}
                onChange={() => toggle(item.value)}
                aria-label={`Select ${item.title}`}
              />
              <span className="flex-1">
                <span className="font-medium">{item.title}</span>
                <span className="block text-xs text-muted-foreground">{item.detail}</span>
              </span>
              {result && !result.ok ? (
                <span className="text-xs text-danger" role="status">
                  Not approved: {result.message}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div aria-live="polite" className="text-sm">
        {state && !state.ok ? <p className="text-danger">{state.error.message}</p> : null}
        {state?.ok ? (
          <p data-testid="bulk-summary">
            {results.length - failed.length} approved
            {failed.length > 0 ? `, ${failed.length} could not be approved` : ""}.
          </p>
        ) : null}
      </div>
    </form>
  );
}
