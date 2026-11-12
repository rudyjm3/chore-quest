/**
 * Fixed avatar set for child profiles. Children never upload photos (privacy: no child images),
 * so an avatar is just a key from this list. Glyphs are emoji so no artwork pipeline is needed;
 * swap for illustrations via the asset manifest later without changing stored keys.
 */
export const AVATARS = [
  { key: "avatar.fox", glyph: "🦊", label: "Fox" },
  { key: "avatar.owl", glyph: "🦉", label: "Owl" },
  { key: "avatar.bear", glyph: "🐻", label: "Bear" },
  { key: "avatar.panda", glyph: "🐼", label: "Panda" },
  { key: "avatar.lion", glyph: "🦁", label: "Lion" },
  { key: "avatar.frog", glyph: "🐸", label: "Frog" },
  { key: "avatar.octopus", glyph: "🐙", label: "Octopus" },
  { key: "avatar.dino", glyph: "🦖", label: "Dino" },
  { key: "avatar.unicorn", glyph: "🦄", label: "Unicorn" },
  { key: "avatar.penguin", glyph: "🐧", label: "Penguin" },
  { key: "avatar.turtle", glyph: "🐢", label: "Turtle" },
  { key: "avatar.dolphin", glyph: "🐬", label: "Dolphin" },
] as const;

export type AvatarKey = (typeof AVATARS)[number]["key"];

export const AVATAR_KEYS = AVATARS.map((a) => a.key) as [AvatarKey, ...AvatarKey[]];

export const DEFAULT_AVATAR_GLYPH = "🙂";

export function avatarGlyph(key: string | null | undefined): string {
  return AVATARS.find((a) => a.key === key)?.glyph ?? DEFAULT_AVATAR_GLYPH;
}
