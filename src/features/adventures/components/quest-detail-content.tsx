"use client";

import Link from "next/link";
import type { RefObject } from "react";

import { ProgressBar } from "@/components/shared/progress-bar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { BoardQuest } from "../quest-board";

/**
 * Quest detail body (ADR 0018), loaded on the first tap by `QuestDetailDialog`: everything comes from props the board page already loaded for the signed-in
 * child. Open/closed state is local to the dialog; nothing is fetched, written or persisted.
 */
export default function QuestDetailContent({
  quest,
  chapterTitle,
  reward,
  open,
  onOpenChange,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opened the dialog; it gets focus back when the dialog closes. */
  returnFocusTo: RefObject<HTMLButtonElement | null>;
  quest: BoardQuest;
  chapterTitle: string;
  /** Reward line already formatted by `describeReward`; empty when the quest pays nothing. */
  reward: string;
}) {
  const kindLabel = quest.kind === "MAIN" ? "Main quest" : "Side mission";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto border-2 border-pirate-wood/40 bg-pirate-parchment"
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo.current?.focus();
        }}
        data-testid="quest-detail"
      >
        <DialogHeader>
          <p className="text-xs font-semibold tracking-wide text-pirate-wood uppercase">
            {kindLabel} · {chapterTitle}
          </p>
          <DialogTitle className="text-xl font-black">{quest.title}</DialogTitle>
          <DialogDescription>
            {quest.description ?? "No story for this quest yet. Just do the steps below!"}
          </DialogDescription>
        </DialogHeader>

        <section aria-labelledby={`qd-steps-${quest.key}`} className="space-y-3">
          <h3 id={`qd-steps-${quest.key}`} className="font-black">
            Steps
          </h3>
          <ul className="space-y-3">
            {quest.objectives.map((objective) => (
              <li key={objective.key} data-testid="quest-detail-objective">
                <ProgressBar
                  value={objective.currentCount}
                  max={objective.targetCount}
                  label={`${objective.completed ? "✅ " : ""}${objective.title}`}
                />
              </li>
            ))}
          </ul>
        </section>

        <p className="text-sm font-semibold" data-testid="quest-detail-reward">
          Reward: {reward || "Nothing extra, just the glory!"}
        </p>

        {quest.location ? (
          <p className="text-sm" data-testid="quest-detail-location">
            Where: {quest.location.name}
            {quest.location.href ? (
              <>
                {" "}
                <Link
                  href={quest.location.href}
                  className="inline-flex min-h-11 items-center font-bold underline"
                >
                  Go there
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" className="min-h-11 rounded-2xl px-6 text-base font-bold">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
