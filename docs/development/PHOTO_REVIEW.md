# Privacy review: photos on chore submissions

**Status: review document approved by the owner on 2026-11-13; feature not yet cleared to build.** The owner's approval covers this review as the basis for deciding. The go/no-go checklist (section 10) is still open, so no upload control, storage bucket, image column or vendor account may be added until the owner completes it. Nothing described here is built. No upload control, storage bucket, image column or vendor account exists.
The owner must complete the sign-off checklist (section 10) before any implementation starts. This document is the basis for that decision, not
legal advice; items marked **[legal]** need review by a qualified privacy lawyer.

## 1. Purpose and the case for / against

Parents sometimes want proof that a chore was done ("photo of the made bed"). Benefits: fewer disputes, parents can approve without walking
to the room. Costs: we would store images of minors and of their homes, the most sensitive data the product could hold, to solve a problem
that text notes and in-person checks already cover. **Default recommendation: no-go for the MVP; revisit after the pilot (ROADMAP Phase 6).**

## 2. Data flow (if built)

1. Child taps "add photo" on a submission → browser camera/file picker (no background capture).
2. Client downsizes and re-encodes the image (strips EXIF/location in the browser), sends it to a server action over HTTPS.
3. Server re-validates type and size, **re-strips metadata server-side** (never trust the client), generates a random object key, and writes to a
   private bucket. The database stores only the key, size, checksum and `submissionId` (family- and child-scoped).
4. Parent views the image through a short-lived signed URL issued after `requireParentContext()` and a `familyId` check. No public URLs.
5. Deletion: on parent decision, on retention expiry, on child archive, on family delete. Object and row are removed together, audited.

## 3. What could be captured by accident

| Risk                                                      | Mitigation to require                                                  |
| --------------------------------------------------------- | ---------------------------------------------------------------------- |
| Child's face, siblings, friends, other children           | Copy that asks for "the thing, not people"; parent can reject + delete |
| Home interior, address numbers, mail, screens, documents  | Same copy; no automated analysis; retention short                      |
| EXIF GPS, device model, timestamps                        | Strip on client and again on server; reject images where strip fails   |
| Nudity / unsafe content (child or third party)            | Cannot be detected reliably without a vendor scan (see section 8)      |
| Image used to bypass approval (photo of a stranger's bed) | Photos are evidence for a parent, never auto-approved or auto-scored   |

## 4. Consent and legal basis **[legal]**

- **COPPA (US, under 13):** verifiable parental consent is required before collecting personal information from a child; photos and
  audio/video of a child are personal information. Our model has parents create child profiles, but that is not by itself consent to image
  collection: a separate, explicit, revocable per-family opt-in is needed.
- **GDPR / GDPR-K (EU/UK):** images of children are personal data; child consent age varies by member state (13–16), so parental
  authorisation is required; lawful basis, DPIA (large-scale processing of children's data), records of processing, data-subject rights
  (access, erasure) must be supported. UK Age Appropriate Design Code applies to features likely to be used by children.
- **Other:** state laws (e.g. California CPRA/CCPA minors' provisions) may add duties. Counsel to confirm the target launch regions.
- Consent copy must say what is stored, who can see it, for how long, and how to delete everything; withdrawal turns the feature off and
  deletes stored images.

## 5. Storage vendor and region **[legal]**

- Candidate: a private object store with encryption at rest, per-object access via signed URLs, deletion APIs, and access logs. Vendor to be
  chosen only after approval; a processor agreement (DPA) with SCCs where data leaves the EU/UK is required before any production upload.
- Region must match the household's region of use (US or EU/UK buckets); no cross-region replication without review.
- Vendor must not use images to train models or for advertising; sub-processors listed.

## 6. Retention and deletion

- Proposed default: images deleted **7 days after the parent's decision** (approved or rejected) and no later than **30 days** after upload;
  nothing kept for "history". The completion record (points, dates) stays without the image.
- Parent can delete any image at once; deleting a child or a family deletes their images (cascade plus object deletion, verified by test).
- Backups must not extend the retention window beyond a documented bound (target: ≤ 35 days).

## 7. Who can view

- Only guardians/owners of the same family (`canApprove`). Never other families, never other children, never support staff by default.
- Any operator access (support, debugging) needs a logged, time-boxed break-glass process; no routine access.
- Children see only their own thumbnail until it is deleted.

## 8. Moderation and abuse

- No public sharing, comments or social features. Images are visible only to the household's adults.
- Reporting path for accidental sensitive content (parent deletes; document how to escalate).
- Decide whether to run automated unsafe-content detection (a further processor and more data flow) or accept manual parent review only.
- Upload limits: size, rate per child per day, allowed types (JPEG/PNG/WebP), no animated or multi-frame formats.

## 9. Engineering requirements if approved

Keep to AGENTS.md: services own writes, idempotent, family/child scoped, audit entries for view and delete, no secrets in client code, env vars
validated in `src/lib/env.ts` and documented, tests that violate each invariant (cross-family access, expired URL, missing consent, delete cascade),
e2e smoke for the consent flow, and an ADR recording the vendor and retention decision.

## 10. Go / no-go checklist (owner sign-off)

| #   | Item                                                                               | Decision     |
| --- | ---------------------------------------------------------------------------------- | ------------ |
| 1   | A concrete product need justifies storing children's images (see section 1)        | ☐ go ☐ no-go |
| 2   | Target launch regions confirmed; legal basis and consent flow reviewed **[legal]** | ☐            |
| 3   | DPIA completed (if EU/UK users)                                                    | ☐            |
| 4   | Storage vendor and region chosen; DPA/processor terms signed                       | ☐            |
| 5   | Retention windows (section 6) accepted, including backup bound                     | ☐            |
| 6   | Access model (section 7) and break-glass process accepted                          | ☐            |
| 7   | Moderation approach (section 8) decided                                            | ☐            |
| 8   | Privacy notice and parental-consent copy written and published                     | ☐            |
| 9   | `PRIVACY.md` updated to record this approval                                       | ☐            |

Approved by: ______________________ Date: ____________ (leave blank until signed)
