"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import type { BoardQuest } from "../quest-board";

// The dialog (Radix) is only needed once a child taps a quest, so it is split out of the board's
// first load (ADR 0018, measured in docs/BUILD_HEALTH_REPORT.md).
const QuestDetailContent = dynamic(() => import("./quest-detail-content"), { ssr: false });

/** Button on a quest card that opens the quest detail. State is local; nothing is fetched or stored. */
export function QuestDetailDialog({
  quest,
  chapterTitle,
  reward,
}: {
  quest: BoardQuest;
  chapterTitle: string;
  reward: string;
}) {
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        ref={trigger}
        type="button"
        variant="outline"
        className="min-h-11 w-full rounded-2xl text-base font-bold"
        data-testid={`quest-details-${quest.key}`}
        aria-haspopup="dialog"
        onClick={() => {
          setRequested(true);
          setOpen(true);
        }}
      >
        Quest details
        <span className="sr-only">: {quest.title}</span>
      </Button>
      {requested ? (
        <QuestDetailContent
          quest={quest}
          chapterTitle={chapterTitle}
          reward={reward}
          open={open}
          onOpenChange={setOpen}
          returnFocusTo={trigger}
        />
      ) : null}
    </>
  );
}
