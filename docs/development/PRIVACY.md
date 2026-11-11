# Privacy and children's data

Chore Quests expects children under 13 to use the child interface. This document separates the
technical controls already built from the legal/privacy work that still requires review. **Nothing here
is a claim of legal compliance.**

## Data collected about children (by design, minimal)

| Data                    | Where                                                        | Why                                          | Optional |
| ----------------------- | ------------------------------------------------------------ | -------------------------------------------- | -------- |
| Display name / nickname | `child.displayName`                                          | Identify the child to the family             | required |
| Avatar key              | `child.avatarKey`                                            | Cosmetic, from a fixed set                   | yes      |
| Birth year              | `child.birthYear`                                            | Future age-appropriate content; unused today | yes      |
| PIN hash                | `child_credential`                                           | Family-managed sign-in                       | yes      |
| Activity data           | occurrences, completions, goals, rewards, adventure progress | Core function                                | —        |
| Session metadata        | `child_session` (timestamps, issuing parent)                 | Security                                     | —        |

Not collected: child email, surname, photo, free-text about the child beyond parent-written notes,
precise location, device identifiers beyond the session cookie. No third-party analytics or ads SDKs
are included. Next.js anonymous telemetry applies to the build tool only (opt out with
`npx next telemetry disable`).

## Technical controls in place

- Children never create accounts; a parent/guardian creates the profile (a form of parental control).
- Parents can archive a child (sessions revoked) and delete a family (cascading delete of all household data).
- Audit history for sensitive parental and reward actions.
- Data minimisation enforced by schema (no email/surname columns on `child`).
- `family_settings.historyRetentionDays` reserved for a retention job.

## Requires legal/privacy review before launch (not implemented)

- **COPPA (US)**: verifiable parental consent flow and record-keeping, direct notice to parents, privacy
  policy content, data access/deletion requests, limits on retention, operator contact details.
  Parent-created profiles help but do not by themselves satisfy "verifiable" consent.
- **GDPR / UK GDPR and the Age Appropriate Design Code** if serving EU/UK families: lawful basis, child-
  friendly notices, default high-privacy settings, DPIA.
- **App store / platform policies** if packaged as a PWA/app targeting children.
- Retention schedule and automated deletion job; export of a family's data.
- Review of every parent-entered free-text field (task notes, reward names) as potential personal data.
- Vendor assessment of Vercel and Supabase as processors (DPAs, regions).

## Guidance for contributors

- Do not add child data fields without updating this document and getting a review.
- Do not log child identifiers with content; prefer ids in structured logs.
- Keep the child UI free of external links, chat, or user-generated public content.
