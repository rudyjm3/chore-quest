import Link from "next/link";

import { AcceptInvitationForm } from "@/features/families/components/invitation-forms";
import { getParentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { invitationTokenSchema } from "@/lib/validation/invitations";
import { previewInvitation } from "@/server/services/invitation.service";

export const metadata = { title: "Family invitation" };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const parsed = invitationTokenSchema.safeParse(token);
  const preview = parsed.success ? await previewInvitation(prisma, parsed.data) : null;

  if (!preview || !parsed.success) {
    return (
      <div className="space-y-3" data-testid="invite-invalid">
        <h1 className="text-xl font-bold">Invitation not available</h1>
        <p className="text-sm text-muted-foreground" role="alert">
          This invitation link is invalid, has already been used, or has expired. Ask the family
          owner to send a new one.
        </p>
      </div>
    );
  }

  const session = await getParentSession();
  const next = encodeURIComponent(`/invite/${parsed.data}`);

  return (
    <div className="space-y-4" data-testid="invite-page">
      <h1 className="text-xl font-bold">Join {preview.familyName}</h1>
      <p className="text-sm text-muted-foreground">
        You&apos;ve been invited to help manage this household on Chore Quests.
      </p>
      {session ? (
        <div className="space-y-2">
          <p className="text-sm">
            Signed in as <strong>{session.user.email}</strong>. The invitation only works for the
            address it was sent to.
          </p>
          <AcceptInvitationForm token={parsed.data} />
        </div>
      ) : (
        <div className="space-y-2">
          <Link
            href={`/sign-in?next=${next}`}
            className="block rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
          >
            Sign in to accept
          </Link>
          <Link
            href={`/sign-up?next=${next}`}
            className="block rounded-md border px-3 py-2 text-center text-sm font-medium"
          >
            Create an account
          </Link>
        </div>
      )}
    </div>
  );
}
