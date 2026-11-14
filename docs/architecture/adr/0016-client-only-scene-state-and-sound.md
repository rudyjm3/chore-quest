# ADR 0016 — Client-only scene state (Zustand), CSS/SVG animation and an opt-in sound toggle

Status: accepted (Phase 4, Parrot Island)

## Context

The roadmap asks for scene animations (a compass needle that reacts to the puzzle, bobbing markers) and a sound toggle. These are
presentation: they must never become part of game state, never touch `child_adventure_progress.state` or any table, and must respect
`prefers-reduced-motion`. No audio artwork exists yet, and the app is used by children under 13, so sound must be off until a child turns it on.

## Decision

- **Zustand store, in memory only** (`src/features/adventures/scene-store.ts`, `"use client"` consumers only). It holds `celebration`
  (what to animate, with a nonce so the same animation can replay), `needle` (`idle | wobble | spin`) and `soundOn`. Nothing in it is
  sent to a server action, read by a service or written to the database.
- **The one thing that is remembered is the sound preference**, in `localStorage` under a single key, read and written inside
  `try/catch` (private mode, blocked storage and SSR must all fall back to "off"). It is read after mount (never during render) so
  server and client markup agree. It is a device preference, not child data, and does not follow the child to another device.
- **Sound is off by default and needs no audio files.** A small helper synthesises a short chime with the Web Audio API (an oscillator),
  only when sound is on and only in response to a user action. If audio files are ever added they must go through the asset manifest with
  a placeholder (an `audio` asset type would be an additive manifest change) and the same toggle.
- **Animation is CSS/SVG keyframes** in `globals.css`, switched by `data-` attributes the store drives. Every keyframe animation is
  disabled under `@media (prefers-reduced-motion: reduce)`, and meaning is never carried by motion alone (text and `aria-live` messages say what
  happened).
- **The client still never decides success.** The needle spins only after the server reports `correct: true`; a wrong attempt wobbles
  after the server said it was wrong.

## Consequences

- Resetting or losing the store loses nothing that matters: a reload replays no celebration and the server state is unchanged.
- The preference is per device. A parent-visible or cross-device setting would need a column and an ADR.
- The store module is plain TypeScript with no React import so it can be unit tested in the Node test environment.
