import { describe, expect, it } from "vitest";

import { lighthouseHint, selectLine, selectSituation } from "@/game/engine";
import { npcDialogueSchema } from "@/game/schemas";
import { pipDialogue } from "@/game/themes/pirate";

const base = { started: true, hasUnclaimedChapterReward: false, inventory: { "supply-crate": 2 } };

describe("selectSituation", () => {
  it("greets a child who has not started", () => {
    expect(selectSituation({ ...base, started: false, inventory: {} }, pipDialogue)).toBe(
      "greeting",
    );
  });
  it("celebrates an unclaimed chapter reward before anything else", () => {
    expect(
      selectSituation({ ...base, hasUnclaimedChapterReward: true, inventory: {} }, pipDialogue),
    ).toBe("quest-complete");
  });
  it("notices low supplies and otherwise greets", () => {
    expect(selectSituation({ ...base, inventory: {} }, pipDialogue)).toBe("low-supplies");
    expect(selectSituation(base, pipDialogue)).toBe("greeting");
  });
});

describe("selectLine", () => {
  it("is deterministic for a seed and always one of the authored lines", () => {
    const a = selectLine(pipDialogue, base, "2026-11-13");
    expect(selectLine(pipDialogue, base, "2026-11-13")).toEqual(a);
    expect(pipDialogue.lines[a.situation]).toContain(a.line);
  });
  it("rotates across days", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 28; d += 1) {
      seen.add(selectLine(pipDialogue, base, `2026-11-${String(d).padStart(2, "0")}`).line);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("authored dialogue", () => {
  it("validates and has lines for every situation", () => {
    expect(() => npcDialogueSchema.parse(pipDialogue)).not.toThrow();
    for (const lines of Object.values(pipDialogue.lines)) expect(lines.length).toBeGreaterThan(0);
  });
  it("rejects a theme that forgets a situation", () => {
    expect(() =>
      npcDialogueSchema.parse({ ...pipDialogue, lines: { greeting: ["hi"] } }),
    ).toThrow();
  });
});

describe("lighthouseHint", () => {
  const ch = (sortOrder: number, status: string, hint: string | null) => ({
    sortOrder,
    status,
    hint,
  });
  it("uses the furthest playable chapter's hint", () => {
    expect(
      lighthouseHint([ch(1, "COMPLETED", "a"), ch(2, "IN_PROGRESS", "b"), ch(3, "LOCKED", "c")]),
    ).toBe("b");
  });
  it("falls back to the next locked chapter, then to nothing", () => {
    expect(lighthouseHint([ch(1, "COMPLETED", "a"), ch(2, "LOCKED", "c")])).toBe("c");
    expect(lighthouseHint([ch(1, "COMPLETED", null)])).toBeNull();
    expect(lighthouseHint([])).toBeNull();
  });
});
