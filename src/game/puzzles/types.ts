/**
 * Puzzle verifiers run on the server. The client only submits an answer; the
 * server decides whether it is correct using the puzzle's stored config.
 */
export interface PuzzleVerifier<TConfig = unknown> {
  type: string;
  parseConfig(raw: Record<string, unknown>): TConfig;
  verify(config: TConfig, answer: unknown): { correct: boolean; feedback?: string };
  /**
   * The only part of the config that may be sent to the browser. It must never contain the answer;
   * `toClientView` is what pages and components get, never the stored config.
   */
  toClientView(config: TConfig): Record<string, unknown>;
}
