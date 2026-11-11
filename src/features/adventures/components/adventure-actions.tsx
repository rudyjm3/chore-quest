"use client";

import { useState } from "react";

import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";

import { claimChapterRewardAction, startAdventureAction, submitPuzzleAction } from "../actions";

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

/** Sequence-match puzzle UI: tap symbols in order, then submit. Verified on the server. */
export function SequencePuzzle({
  puzzleId,
  title,
  symbols,
  hint,
}: {
  puzzleId: string;
  title: string;
  symbols: string[];
  hint?: string;
}) {
  const [sequence, setSequence] = useState<string[]>([]);
  return (
    <div
      className="space-y-3 rounded-3xl border-4 border-pirate-wood bg-pirate-parchment p-4"
      data-testid="puzzle"
    >
      <h3 className="text-lg font-black">{title}</h3>
      {hint ? <p className="text-sm italic">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        {symbols.map((symbol) => (
          <Button
            key={symbol}
            type="button"
            variant="secondary"
            className="size-14 rounded-2xl text-xl font-black"
            onClick={() => setSequence((s) => (s.length < 12 ? [...s, symbol] : s))}
          >
            {symbol}
          </Button>
        ))}
      </div>
      <p className="min-h-6 text-xl tracking-widest" aria-live="polite">
        {sequence.join(" → ") || "Tap the symbols in order…"}
      </p>
      <ActionForm action={submitPuzzleAction} className="flex gap-2" resetOnSuccess={false}>
        <input type="hidden" name="puzzleId" value={puzzleId} />
        {sequence.map((s, i) => (
          <input key={i} type="hidden" name="sequence" value={s} />
        ))}
        <SubmitButton disabled={sequence.length === 0} className="rounded-2xl font-black">
          Check answer
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setSequence([])}>
          Clear
        </Button>
      </ActionForm>
    </div>
  );
}
