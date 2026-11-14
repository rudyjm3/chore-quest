# ADR 0015 — Location pages (feather grove, compass shrine) and a client-safe puzzle view

Status: accepted (Phase 4, Parrot Island)

## Context

Chapter scenes list their locations as non-interactive labels. Parrot Island's `feather-grove` (a `quest-board` location for
`recover-the-compass`) and `compass-shrine` (a `puzzle` location) must become places the child can open, and the compass puzzle screen
needs to be richer. Two things must stay true: no new tables or pirate-specific code in services, and the client never learns the answer
to a puzzle. Today the chapter page reads `puzzle_definition.config` itself and hand-picks `symbols`/`hint`; one careless change would ship the
stored `sequence` to the browser.

## Decision

- **One generic route, `/child/adventure/[chapterKey]/[locationKey]`.** It resolves the location from the chapter config that
  `getAdventureState` already returns (own data only: the state is scoped by `childId`). Locations of kind `quest-board` (with `questKey`)
  and `puzzle` (with `puzzleKey`) get a page and become links in the scene; every other kind stays a label. Unknown chapter or location,
  or a location without a page, is a 404; a locked chapter shows the usual "still hidden in the mist" message. Nothing here is Parrot
  Island specific, so the Home Port quest-board location gets the same page for free.
- **No new tables, no new writes.** The grove shows the quest card for `questKey` plus a row of progress slots built from its
  `APPROVED_ACTIVITIES` objectives (`currentCount` of `targetCount`: for the compass quest, the feathers). Feathers are granted by the engine as
  before; the page only reads.
- **`getAdventureState` objectives gain two read-only fields**: `puzzleKey` (from the objective config) and `available` (no
  `requiresObjectiveKey`, or that objective is completed). The shrine uses them to say "collect the feathers first" instead of showing a puzzle
  the server would refuse. They are display hints only: `submitPuzzleAnswer` re-checks the gate under the child lock as before.
- **`PuzzleVerifier.toClientView(config)`** is a new, required method on every verifier: it returns the only part of a puzzle's config
  that may leave the server (for `sequence-match`: `symbols` and `hint`, never `sequence`). A read service, `getPuzzleForChild`, returns
  `{ id, title, type, view, solved }` after checking the chapter is not locked for that child. Pages and components use it instead of
  parsing `puzzle_definition.config` themselves. A unit test asserts the view never contains the answer.
- **The verifier stays theme-neutral.** Its feedback strings no longer mention compasses; the pirate flavour comes from the theme
  (`hint`, the dialogue layer, the animations in ADR 0016).
- **Feedback on a wrong attempt does not leak.** The server says only that the attempt was not right. It never reports how many
  symbols were correct or in which positions, and the client never decides success: it shows the server's verdict and refreshes.

## Consequences

- Adding a location page for another kind later means one more case in the pure `buildLocationView`.
- Failed attempts are still stored one row per attempt with no rate limit (unchanged). With four symbols and a length-four answer that is
  not a security boundary (the reward is a game item), but a lockout or backoff would be needed before puzzles guard anything of real value.
- The puzzle can still be reached from the chapter page, which now renders the same shared puzzle component.
