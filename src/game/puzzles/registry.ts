import { pairMatchPuzzle } from "./pair-match";
import { sequenceMatchPuzzle } from "./sequence-match";
import type { PuzzleVerifier } from "./types";

const verifiers: Record<string, PuzzleVerifier> = {
  [sequenceMatchPuzzle.type]: sequenceMatchPuzzle as PuzzleVerifier,
  [pairMatchPuzzle.type]: pairMatchPuzzle as PuzzleVerifier,
};

export function getPuzzleVerifier(type: string): PuzzleVerifier {
  const verifier = verifiers[type];
  if (!verifier) throw new Error(`Unknown puzzle type: ${type}`);
  return verifier;
}

export function listPuzzleTypes(): string[] {
  return Object.keys(verifiers);
}
