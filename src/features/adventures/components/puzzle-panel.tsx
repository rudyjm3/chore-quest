import { pairMatchClientViewSchema, sequenceMatchClientViewSchema } from "@/game/puzzles";
import { prisma } from "@/lib/db/prisma";
import type { ChildContext } from "@/server/policies/context";
import { getPuzzleForChild } from "@/server/services/adventure.service";

import { PairPuzzle } from "./pair-puzzle";
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
  if (puzzle.gate && !puzzle.gate.met && !puzzle.solved) {
    const need = puzzle.gate.quantity - (inventory?.[puzzle.gate.itemKey] ?? 0);
    return (
      <p
        className="rounded-3xl border-4 border-dashed border-pirate-wood/50 p-5 text-center"
        data-testid="puzzle-gated"
      >
        🔒 {puzzle.title} needs {puzzle.gate.quantity} ×{" "}
        {itemNames?.[puzzle.gate.itemKey] ?? "more items"} in your hold
        {need > 0 && inventory ? ` (${need} more)` : ""}. Keep finishing chores to collect them.
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
