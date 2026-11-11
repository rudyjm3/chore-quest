import { z } from "zod";

import type { PuzzleVerifier } from "./types";

/**
 * "sequence-match": the child must reproduce a short sequence of symbols
 * (e.g. compass directions). Used by the Parrot Island compass puzzle.
 */
const configSchema = z.object({
  symbols: z.array(z.string().min(1)).min(2).max(12),
  sequence: z.array(z.string().min(1)).min(2).max(12),
  hint: z.string().optional(),
});
export type SequenceMatchConfig = z.infer<typeof configSchema>;

const answerSchema = z.object({ sequence: z.array(z.string()).max(12) });

export const sequenceMatchPuzzle: PuzzleVerifier<SequenceMatchConfig> = {
  type: "sequence-match",
  parseConfig(raw) {
    const config = configSchema.parse(raw);
    if (!config.sequence.every((s) => config.symbols.includes(s))) {
      throw new Error("sequence-match: sequence contains symbols not in the symbol set");
    }
    return config;
  },
  verify(config, answer) {
    const parsed = answerSchema.safeParse(answer);
    if (!parsed.success) return { correct: false, feedback: "Answer must be a list of symbols" };
    const given = parsed.data.sequence;
    const correct =
      given.length === config.sequence.length && given.every((s, i) => s === config.sequence[i]);
    return {
      correct,
      feedback: correct ? "The compass needle spins and settles!" : "Not quite. Try again.",
    };
  },
};
