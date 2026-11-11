/**
 * Puzzle verifiers run on the server. The client only submits an answer; the
 * server decides whether it is correct using the puzzle's stored config.
 */
export interface PuzzleVerifier<TConfig = unknown> {
  type: string;
  parseConfig(raw: Record<string, unknown>): TConfig;
  verify(config: TConfig, answer: unknown): { correct: boolean; feedback?: string };
}
