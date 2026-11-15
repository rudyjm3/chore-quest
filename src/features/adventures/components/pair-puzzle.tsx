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
 * Pair-match puzzle (ADR 0019). Tap a part, then tap the tool that fixes it; tap a matched part again to
 * change it. The SERVER decides whether the matching is right: this component only sends the pairs and shows
 * the verdict, and never learns the answer (only parts, tools and the hint reach the browser). A wrong
 * attempt says nothing about which pairs were right.
 */
export function PairPuzzle({
  puzzleId,
  title,
  parts,
  tools,
  hint,
  solved,
}: {
  puzzleId: string;
  title: string;
  parts: Labelled[];
  tools: Labelled[];
  hint?: string | null;
  solved: boolean;
}) {
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(parts[0]?.key ?? null);
  const [verdict, setVerdict] = useState<Verdict>({ kind: "none" });
  const [announce, setAnnounce] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [pending, startTransition] = useTransition();
  const done = solved || verdict.kind === "solved";
  const locked = pending || done;
  const complete = parts.every((p) => pairs[p.key]);
  const toolLabel = (key: string | undefined) => tools.find((t) => t.key === key)?.label;

  function choosePart(partKey: string) {
    if (locked) return;
    setSelected(partKey);
    setAnnounce(`Choose a tool for ${parts.find((p) => p.key === partKey)?.label}.`);
  }
  function chooseTool(toolKey: string) {
    if (locked || !selected) return;
    const next = { ...pairs };
    // A tool fixes one part: moving it takes it off whichever part had it.
    for (const [part, tool] of Object.entries(next)) if (tool === toolKey) delete next[part];
    next[selected] = toolKey;
    setPairs(next);
    setVerdict({ kind: "none" });
    const partLabel = parts.find((p) => p.key === selected)?.label;
    setAnnounce(
      `${partLabel}: ${toolLabel(toolKey)}. ${Object.keys(next).length} of ${parts.length} matched.`,
    );
    setSelected(parts.find((p) => !next[p.key])?.key ?? selected);
  }
  function clear() {
    if (locked || Object.keys(pairs).length === 0) return;
    setPairs({});
    setSelected(parts[0]?.key ?? null);
    setVerdict({ kind: "none" });
    setAnnounce("Cleared. Start again.");
  }
  function check() {
    if (locked || !complete) return;
    const form = new FormData();
    form.set("puzzleId", puzzleId);
    form.set("answerJson", JSON.stringify({ pairs }));
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
          message: `${data.feedback ?? "Not quite."} Tap a part to give it a different tool.`,
        });
      }
    });
  }

  const usedTools = new Set(Object.values(pairs));

  return (
    <section
      className="space-y-4 rounded-3xl border-4 border-pirate-wood bg-pirate-parchment p-4"
      data-testid="puzzle"
      data-puzzle-type="pair-match"
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
            <p className="mb-1 text-sm font-bold">1. Tap a part that needs fixing</p>
            <ul
              key={attempts}
              aria-label="Parts"
              className={`space-y-2 ${verdict.kind === "wrong" ? "cq-shake" : ""}`}
            >
              {parts.map((part) => {
                const tool = toolLabel(pairs[part.key]);
                return (
                  <li key={part.key}>
                    <Button
                      type="button"
                      variant={selected === part.key ? "default" : "secondary"}
                      aria-pressed={selected === part.key}
                      disabled={locked}
                      data-testid={`part-${part.key}`}
                      className="min-h-12 w-full justify-between gap-3 rounded-2xl px-4 text-left text-base font-black"
                      onClick={() => choosePart(part.key)}
                    >
                      <span>{part.label}</span>
                      <span className="text-sm font-bold" data-testid={`part-${part.key}-tool`}>
                        {tool ? `🔧 ${tool}` : "Choose a tool"}
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <p className="mb-1 text-sm font-bold">2. Tap the tool that fixes it</p>
            <div role="group" aria-label="Tools" className="flex flex-wrap gap-2">
              {tools.map((tool) => (
                <Button
                  key={tool.key}
                  type="button"
                  variant="outline"
                  disabled={locked || !selected}
                  aria-pressed={usedTools.has(tool.key)}
                  data-testid={`tool-${tool.key}`}
                  className={`min-h-12 rounded-2xl px-4 font-bold ${
                    usedTools.has(tool.key) ? "opacity-60" : ""
                  }`}
                  onClick={() => chooseTool(tool.key)}
                >
                  {tool.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-2xl"
              disabled={locked || Object.keys(pairs).length === 0}
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
