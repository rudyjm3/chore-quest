"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { submitPuzzleAction } from "../actions";
import { sceneStore } from "../scene-store";
import { playFeedbackSound } from "../sound";
import { FeedbackDial } from "./feedback-dial";
import { SoundToggle } from "./sound-toggle";

const MAX_PICKS = 12;

type Verdict =
  | { kind: "none" }
  | { kind: "wrong"; message: string }
  | { kind: "solved"; message: string }
  | { kind: "error"; message: string };

/**
 * Sequence-match puzzle (ADR 0015/0016). The child builds a sequence by tapping symbols; Undo and Clear fix
 * mistakes. The SERVER decides whether it is right: this component only shows the verdict it is given and
 * never learns the answer (only `symbols` and `hint` reach the browser). A wrong attempt says nothing about
 * which symbols were right.
 */
export function SequencePuzzle({
  puzzleId,
  title,
  symbols,
  hint,
  solved,
}: {
  puzzleId: string;
  title: string;
  symbols: string[];
  hint?: string | null;
  /** Server-side truth (the puzzle objective is complete); stays mounted so the celebration can finish. */
  solved: boolean;
}) {
  const [picks, setPicks] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<Verdict>({ kind: "none" });
  const [announce, setAnnounce] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [pending, startTransition] = useTransition();
  const done = solved || verdict.kind === "solved";
  const locked = pending || done;

  function pick(symbol: string) {
    if (locked || picks.length >= MAX_PICKS) return;
    const next = [...picks, symbol];
    setPicks(next);
    setVerdict({ kind: "none" });
    setAnnounce(`Added ${symbol}. ${next.length} chosen.`);
  }
  function undo() {
    if (locked || picks.length === 0) return;
    const removed = picks[picks.length - 1];
    setPicks(picks.slice(0, -1));
    setVerdict({ kind: "none" });
    setAnnounce(`Removed ${removed}. ${picks.length - 1} chosen.`);
  }
  function clear() {
    if (locked || picks.length === 0) return;
    setPicks([]);
    setVerdict({ kind: "none" });
    setAnnounce("Cleared. Start again.");
  }
  function check() {
    if (locked || picks.length === 0) return;
    const form = new FormData();
    form.set("puzzleId", puzzleId);
    for (const symbol of picks) form.append("sequence", symbol);
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
          message: `${data.feedback ?? "Not quite."} Undo a step or clear and try a new order.`,
        });
      }
    });
  }

  return (
    <section
      className="space-y-4 rounded-3xl border-4 border-pirate-wood bg-pirate-parchment p-4"
      data-testid="puzzle"
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
          🧩 {title} solved!
        </p>
      ) : (
        <>
          <div>
            <p className="mb-1 text-sm font-bold">Your sequence</p>
            <ol
              key={attempts}
              aria-label="Your sequence"
              data-testid="puzzle-sequence"
              className={`flex min-h-14 flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-pirate-wood/50 bg-white/50 p-2 ${
                verdict.kind === "wrong" ? "cq-shake" : ""
              }`}
            >
              {picks.length === 0 ? (
                <li className="px-2 text-sm text-muted-foreground">
                  Tap the symbols below in order.
                </li>
              ) : (
                picks.map((symbol, i) => (
                  <li
                    key={i}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-pirate-wood px-3 text-lg font-black text-white"
                  >
                    <span className="sr-only">Step {i + 1}: </span>
                    {symbol}
                  </li>
                ))
              )}
            </ol>
          </div>

          <div role="group" aria-label="Symbols" className="flex flex-wrap gap-2">
            {symbols.map((symbol) => (
              <Button
                key={symbol}
                type="button"
                variant="secondary"
                disabled={locked}
                aria-label={`Add ${symbol}`}
                className="size-16 rounded-2xl text-2xl font-black"
                onClick={() => pick(symbol)}
              >
                {symbol}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-2xl"
              disabled={locked || picks.length === 0}
              onClick={undo}
            >
              ↩ Undo
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-2xl"
              disabled={locked || picks.length === 0}
              onClick={clear}
            >
              Clear
            </Button>
            <Button
              type="button"
              className="min-h-11 rounded-2xl font-black"
              disabled={locked || picks.length === 0}
              onClick={check}
              data-testid="puzzle-check"
            >
              {pending ? "Checking…" : "Check answer"}
            </Button>
          </div>
        </>
      )}

      {/* Polite live region: choices, then the server's verdict. */}
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
