# ADR 0018 — Quest detail as a dialog; crew-camp scene driven by theme-supplied slot anchors

Status: accepted (Phase 4, Home Port polish)

## Context

Two Home Port items were left open: tapping a quest on the quest board should show its detail, and the crew camp should be a dressed-up ship scene
rather than a list. Both are presentation over data the pages already load (`getAdventureState`, `getCrewCamp`). No new writes, tables or actions.

## Decision

**Quest detail.** A dialog (`src/components/ui/dialog.tsx`, Radix) opened from the quest card, not a route and not an expandable card.
- All data is already on the board page and belongs to the signed-in child (`getAdventureState` is scoped to `ctx.childId`), so a route would only
  re-fetch the same rows and add a second place that must enforce scoping. A dialog adds no request and no URL a child could mistype or share.
- The card becomes a full-width button (≥44px) that opens the dialog; Radix supplies focus trap, Escape, focus return and `aria-modal`.
  Cards stay readable without it: the compact progress bars remain visible, the dialog adds the description, per-objective counts, the reward
  and the location the quest belongs to.
- The location comes from the chapter's authored `locations[].questKey` (pure helper `findQuestLocation` in `quest-board.ts`). It links to the
  location page only when `locationHasPage` says one exists (ADR 0015).
- Only plain serialisable props cross to the client component; the dialog holds open/closed state locally and nothing is persisted.

**Crew-camp scene.** The scene component is theme-neutral: it receives a ship `AssetEntry` and per-slot anchors (`x`/`y` in percent plus a label)
as props. The pirate anchors live in `src/game/themes/pirate/camp.ts` and are resolved through `getCrewCampScene(themeKey)`. Item artwork resolves
through the asset manifest (new placeholder entries for the four wearable items); nothing hard-codes `/assets/...`.
- Slots without an anchor (a theme that adds a slot later) are still listed in the existing picker below the scene, so nothing becomes unwearable.
- The list/picker with `EquipButton` stays as it is: equip/unequip, `equipCosmetic` and its lock are unchanged (ADR 0013). The scene is a
  read-only view of what is equipped. This also keeps the accessible way to change gear a plain list of labelled buttons.
- The only motion is a gentle sway on a decorative inner element (ADR 0016), disabled under `prefers-reduced-motion`, never on a clickable element.

## Consequences

- Quest detail is not deep-linkable. If that is wanted later (share a quest with a parent), a route can reuse the same detail component.
- Anchors are hand-placed per theme; real artwork may need them retuned, which is a theme-file edit only.
