# Email

Parents receive three kinds of mail: **email verification**, **password reset** and **guardian invitations**.
Application code never talks to a mail vendor; it calls `getEmailSender().send(message)` (`src/lib/email`).

## Today: the development driver (`EMAIL_DRIVER=dev`)

- Nothing is delivered. Each message is stored in the `email_outbox` table; only its _kind_ is logged (addresses and links are
  PII/secrets and are never logged).
- Local development: open <http://localhost:3000/dev/outbox> to read the latest 20 messages and click the link. The page returns 404 when
  `NODE_ENV=production`.
- Tests: `latestOutboxMessage(db, to, kind)` and `extractLink(text)` in `src/lib/email/dev-driver.ts` (integration); `tests/e2e/outbox.ts` (e2e).
- Old rows are pruned after 7 days by the maintenance job.
- Guardian invitations additionally show the invite link **once** to the owner after creation, so a household works even when no mail is
  delivered.
- Verification and reset mail cannot reach a real inbox with this driver. A deployment with no provider should set
  `REQUIRE_EMAIL_VERIFICATION=false` (otherwise nobody can sign in), and should treat password reset as unavailable.

## Plugging in a real provider (not done: no paid service was signed up for)

1. Add `src/lib/email/<provider>-driver.ts` exporting `createXxxEmailSender(config): EmailSender` that maps an `EmailMessage`
   (`kind`, `to`, `subject`, plain-text `text`) to the provider's API and throws if the message was not accepted.
2. Add the provider's secrets to `src/lib/env.ts` (server-only), `.env.example`, `docs/development/ENVIRONMENT.md`, the README table and the CI
   workflow (use a dummy value in CI).
3. Extend `EMAIL_DRIVER` in `src/lib/env.ts` (e.g. `z.enum(["dev", "resend"])`) and the `switch` in `src/lib/email/index.ts`.
4. Set `EMAIL_DRIVER`, keep `REQUIRE_EMAIL_VERIFICATION=true`, and verify the sending domain (SPF/DKIM) with the provider.
5. Do not log message bodies, links or recipient addresses. Keep the copy plain text and free of child data.

Any provider with an HTTPS API or SMTP fits the interface; no other code changes are needed.
