/** Pure lighthouse selection (no I/O). Static text from chapter config, no state. */
/** Shows the hint of the chapter the child is on, else of the next one to unlock. */
export interface HintChapter {
  sortOrder: number;
  status: string;
  hint: string | null;
}

export function lighthouseHint(chapters: HintChapter[]): string | null {
  const sorted = [...chapters].sort((a, b) => a.sortOrder - b.sortOrder);
  const current = sorted
    .filter((c) => c.status === "UNLOCKED" || c.status === "IN_PROGRESS")
    .at(-1);
  if (current?.hint) return current.hint;
  return sorted.find((c) => c.status === "LOCKED" && c.hint)?.hint ?? null;
}
