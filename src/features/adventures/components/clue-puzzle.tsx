"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { submitPuzzleAction } from "../actions";
import { sceneStore } from "../scene-store";
import { playFeedbackSound } from "../sound";
import { FeedbackDial } from "./feedback-dial";
import { SoundToggle } from "./sound-toggle";

interface Labelled {
  key: string;
  label: string;
}

type Verdict =
  | { kind: "none" }
  | { kind: "wrong"; message: string }
  | { kind: "solved"; message: string }
  | { kind: "error"; message: string };

/**
 * Clue-order puzzle (ADR 0021). Read the clues, then tap a thing to put it in the next empty place; tap a placed thing
 * to take it back. The SERVER decides whether the order is right: this component sends the order and shows the
 * verdict, and never learns the answer (only the things, the clue sentences and the hint reach the browser).
 */
export function CluePuzzle({
  puzzleId,
  title,
  items,
  slots,
  clues,
  hint,
  solved,
}: {
  puzzleId: string;
  title: string;
  items: Labelled[];
  slots: number;
  clues: string[];
  hint?: string | null;
  solved: boolean;
}) {
  const [order, setOrder] = useState<Array<string | null>>(() =>
    Array.from({ length: slots }, () => null),
  );
  const [verdict, setVerdict] = useState<Verdict>({ kind: "none" });
  const [announce, setAnnounce] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [pending, startTransition] = useTransition();
  const done = solved || verdict.kind === "solved";
  const locked = pending || done;
  const placed = order.filter((key): key is string => key !== null);
  const complete = placed.length === slots;
  const labelOf = (key: string | null) => items.find((i) => i.key === key)?.label ?? "Empty";

  function place(key: string) {
    if (locked || placed.includes(key)) return;
    const at = order.indexOf(null);
    if (at === -1) return;
    const next = [...order];
    next[at] = key;
    setOrder(next);
    setVerdict({ kind: "none" });
    setAnnounce(
      `${labelOf(key)} placed in place ${at + 1}. ${placed.length + 1} of ${slots} placed.`,
    );
  }
  function take(at: number) {
    if (locked || order[at] === null) return;
    const next = [...order];
    setAnnounce(`${labelOf(next[at] ?? null)} taken back from place ${at + 1}.`);
    next[at] = null;
    setOrder(next);
    setVerdict({ kind: "none" });
  }
  function clear() {
    if (locked || placed.length === 0) return;
    setOrder(Array.from({ length: slots }, () => null));
    setVerdict({ kind: "none" });
    setAnnounce("Cleared. Start again.");
  }
  function check() {
    if (locked || !complete) return;
    const form = new FormData();
    form.set("puzzleId", puzzleId);
    form.set("answerJson", JSON.stringify({ order: placed }));
    startTransition(async () => {
      const result = await submitPuzzleAction(null, form);
      const scene = sceneStore.getState();
      if (!result.ok) {
        setVerdict({ kind: "error", message: result.error.message });
        return;
      }
      const data = result.data as { correct: boolean; feedback?: string };
      if (data.correct) {
        scene.signalSolved();
        playFeedbackSound("solved", scene.soundOn);
        setVerdict({ kind: "solved", message: data.feedback ?? "You solved it!" });
      } else {
        scene.signalWrong();
        playFeedbackSound("oops", scene.soundOn);
        setAttempts((n) => n + 1);
        setVerdict({
          kind: "wrong",
          message: `${data.feedback ?? "Not quite."} Read the clues again and tap a place to change it.`,
        });
      }
    });
  }

  return (
    <section
      className="space-y-4 rounded-3xl border-4 border-pirate-wood bg-pirate-parchment p-4"
      data-testid="puzzle"
      data-puzzle-type="clue-order"
      data-solved={done}
      aria-labelledby={`puzzle-${puzzleId}`}
    >
      <div className="flex items-start gap-3">
        <FeedbackDial className="size-16 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 id={`puzzle-${puzzleId}`} className="text-lg font-black">
            {title}
          </h3>
          {hint ? <p className="text-sm italic">{hint}</p> : null}
        </div>
        <SoundToggle />
      </div>

      {done ? (
        <p
          className="cq-pop rounded-2xl bg-pirate-gold/40 p-3 text-center font-black"
          data-testid="puzzle-solved"
        >
          🗝️ {title} solved!
        </p>
      ) : (
        <>
          <div>
            <p className="mb-1 text-sm font-bold">1. Read the clues</p>
            <ol className="list-decimal space-y-1 pl-6 text-sm" data-testid="clues">
              {clues.map((clue) => (
                <li key={clue}>{clue}</li>
              ))}
            </ol>
          </div>

          <div>
            <p className="mb-1 text-sm font-bold">2. Places, from first to last</p>
            <ol
              key={attempts}
              aria-label="Places"
              className={`space-y-2 ${verdict.kind === "wrong" ? "cq-shake" : ""}`}
            >
              {order.map((key, at) => (
                <li key={at}>
                  <Button
                    type="button"
                    variant={key ? "default" : "secondary"}
                    disabled={locked || key === null}
                    data-testid={`clue-slot-${at + 1}`}
                    aria-label={
                      key
                        ? `Place ${at + 1}: ${labelOf(key)}. Tap to take it back.`
                        : `Place ${at + 1}: empty`
                    }
                    className="min-h-12 w-full justify-between gap-3 rounded-2xl px-4 text-left text-base font-black"
                    onClick={() => take(at)}
                  >
                    <span>{at + 1}</span>
                    <span>{key ? labelOf(key) : "Empty"}</span>
                  </Button>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <p className="mb-1 text-sm font-bold">3. Tap a thing to put it in the next place</p>
            <div role="group" aria-label="Things" className="flex flex-wrap gap-2">
              {items.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant="outline"
                  disabled={locked || placed.includes(item.key)}
                  data-testid={`clue-item-${item.key}`}
                  className="min-h-12 rounded-2xl px-4 font-bold"
                  onClick={() => place(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-2xl"
              disabled={locked || placed.length === 0}
              onClick={clear}
            >
              Clear
            </Button>
            <Button
              type="button"
              className="min-h-11 rounded-2xl font-black"
              disabled={locked || !complete}
              onClick={check}
              data-testid="puzzle-check"
            >
              {pending ? "Checking…" : "Check answer"}
            </Button>
          </div>
        </>
      )}

      <p className="sr-only" aria-live="polite" data-testid="puzzle-announce">
        {announce}
      </p>
      <p
        role="status"
        aria-live="polite"
        data-testid="puzzle-feedback"
        data-kind={verdict.kind}
        className={`min-h-6 text-center text-sm font-bold ${
          verdict.kind === "wrong" || verdict.kind === "error" ? "text-danger" : ""
        }`}
      >
        {verdict.kind === "none" ? "" : verdict.message}
      </p>
    </section>
  );
}
