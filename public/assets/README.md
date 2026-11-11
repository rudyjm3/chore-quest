# Assets

- `shared/` — platform-wide images and icons (parent UI).
- `adventures/<theme>/` — per-theme artwork, organised by kind (`world-map`, `scenes`, `characters`, `ships`, `collectibles`, `ui`).

Every file here is referenced through an **asset manifest** (`src/game/themes/<theme>/manifest.ts`),
never by a hard-coded path in components. All current pirate assets are flat-colour prototype
placeholders (`placeholder: true` in the manifest) and must be replaced before launch.
