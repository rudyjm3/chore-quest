import {
  clueOrderClientViewSchema,
  pairMatchClientViewSchema,
  routePlanClientViewSchema,
  sequenceMatchClientViewSchema,
} from "@/game/puzzles";
import { prisma } from "@/lib/db/prisma";
import type { ChildContext } from "@/server/policies/context";
import { getPuzzleForChild } from "@/server/services/adventure.service";

import { CluePuzzle } from "./clue-puzzle";
import { PairPuzzle } from "./pair-puzzle";
import { RoutePuzzle } from "./route-puzzle";
import { SequencePuzzle } from "./sequence-puzzle";

/**
 * Server component that picks the right puzzle UI for a puzzle type. It only ever receives the verifier's
 * client-safe view (ADR 0015), never the stored config, so the answer cannot reach the browser.
 */
export async function PuzzlePanel({
  ctx,
  adventureKey,
  chapterKey,
  puzzleKey,
  available,
  waitingFor,
  inventory,
  itemNames,
}: {
  ctx: ChildContext;
  adventureKey: string;
  chapterKey: string;
  puzzleKey: string;
  available: boolean;
  waitingFor: string | null;
  /** The child's own holdings and item display names, to say how many more are needed. */
  inventory?: Record<string, number>;
  itemNames?: Record<string, string>;
}) {
  const puzzle = await getPuzzleForChild(prisma, ctx, { adventureKey, chapterKey, puzzleKey });
  if (!available && !puzzle.solved) {
    return (
      <p
        className="rounded-3xl border-4 border-dashed border-pirate-wood/50 p-5 text-center"
        data-testid="puzzle-waiting"
      >
        🔒 {puzzle.title} is not ready yet.
        {waitingFor ? ` First: ${waitingFor}.` : " Finish the earlier steps first."}
      </p>
    );
  }
  const missing = puzzle.gates.filter((g) => !g.met);
  if (missing.length > 0 && !puzzle.solved) {
    const names = (key: string) => itemNames?.[key] ?? "more items";
    const needs = missing.map((g) => `${g.quantity} × ${names(g.itemKey)}`).join(" and ");
    const short = missing
      .map((g) => g.quantity - (inventory?.[g.itemKey] ?? 0))
      .filter((n) => n > 0);
    return (
      <p
        className="rounded-3xl border-4 border-dashed border-pirate-wood/50 p-5 text-center"
        data-testid="puzzle-gated"
      >
        🔒 {puzzle.title} needs {needs} in your hold
        {inventory && short.length > 0 && missing.length === 1 ? ` (${short[0]} more)` : ""}. Keep
        finishing chores to collect {missing.length === 1 ? "it" : "them"}.
      </p>
    );
  }
  if (puzzle.type === "pair-match") {
    const view = pairMatchClientViewSchema.parse(puzzle.view);
    return (
      <PairPuzzle
        puzzleId={puzzle.id}
        title={puzzle.title}
        parts={view.parts}
        tools={view.tools}
        hint={view.hint}
        solved={puzzle.solved}
      />
    );
  }
  if (puzzle.type === "clue-order") {
    const view = clueOrderClientViewSchema.parse(puzzle.view);
    return (
      <CluePuzzle
        puzzleId={puzzle.id}
        title={puzzle.title}
        items={view.items}
        slots={view.slots}
        clues={view.clues}
        hint={view.hint}
        solved={puzzle.solved}
      />
    );
  }
  if (puzzle.type === "route-plan") {
    return (
      <RoutePuzzle
        puzzleId={puzzle.id}
        title={puzzle.title}
        board={routePlanClientViewSchema.parse(puzzle.view)}
        solved={puzzle.solved}
      />
    );
  }
  if (puzzle.type === "sequence-match") {
    const view = sequenceMatchClientViewSchema.parse(puzzle.view);
    return (
      <SequencePuzzle
        puzzleId={puzzle.id}
        title={puzzle.title}
        symbols={view.symbols}
        hint={view.hint}
        solved={puzzle.solved}
      />
    );
  }
  return (
    <p className="rounded-3xl border-4 border-dashed border-pirate-wood/50 p-5 text-center">
      🚧 This puzzle is still being built.
    </p>
  );
}
