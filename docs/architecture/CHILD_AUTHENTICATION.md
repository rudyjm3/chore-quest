# Child authentication

## Decision

Children do **not** get Better Auth accounts, emails or passwords. A child is a profile owned by a
family. Access is family-managed:

1. **Family code + PIN (self sign-in).** The child enters the family's short code (`family.childLoginCode`,
   shown to parents in Settings/Children), picks their name, and types a 4–6 digit PIN that a parent set.
   Parents can disable self sign-in per family (`family_settings.allowChildSelfSignIn`).
2. **Hand-over from a parent device.** A signed-in parent presses "Hand device to <child>", which starts a
   child session without a PIN (`startChildSessionAsParent`, audited with the parent's id). The parent's
   Better Auth session on that device is revoked first, so the child cannot open `/parent`; the parent
   signs in again to get back in (covered by an e2e test).

Both paths mint an opaque 256-bit token. Only its HMAC-SHA256 (keyed by `CHILD_SESSION_SECRET`) is stored in
`child_session.tokenHash`; the raw token lives in the `cq_child_session` httpOnly, SameSite=Lax cookie
(Secure in production). Sessions expire after `family_settings.childSessionMinutes` (default 12 h), can be
revoked, and are revoked when a child is archived.

## Protections

- PIN hashes use scrypt with a per-credential salt; 5 failed attempts lock the child for 15 minutes.
- Sign-in errors are uniform ("family code, child, or PIN is not right") to avoid enumerating codes.
- The child picker only returns ids + display names of children **with** a PIN, and only if self sign-in is enabled.
- Parent and child cookies are different names and different verification paths; `ParentContext` and
  `ChildContext` are different TypeScript types. A parent session never authorizes child actions and vice versa
  (covered by e2e tests).

## Remaining product decisions

- Whether the family code should rotate on demand (service support is trivial; UI pending).
- Whether to add device-level "remember this child" (longer sessions on trusted family tablets).
- Age-appropriate content gating using the optional `birthYear` (no decision yet; field is optional and unused).
- Parental consent capture and copy for COPPA (see `docs/development/PRIVACY.md`).
