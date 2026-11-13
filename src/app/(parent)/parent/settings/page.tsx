import { PageHeader } from "@/components/shared/page-header";
import { SignOutEverywhereButton } from "@/features/families/components/auth-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FamilySettingsForm,
  RotateFamilyCodeForm,
} from "@/features/families/components/family-forms";
import { prisma } from "@/lib/db/prisma";
import { requireParentContext } from "@/server/policies/context";
import { getFamilyOverview } from "@/server/services/family.service";
import { listOpenInvitations } from "@/server/services/invitation.service";
import {
  InviteGuardianForm,
  RemoveGuardianButton,
  RevokeInvitationButton,
} from "@/features/families/components/invitation-forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireParentContext();
  const family = await getFamilyOverview(prisma, ctx);
  const invitations = ctx.role === "OWNER" ? await listOpenInvitations(prisma, ctx) : [];
  return (
    <>
      <PageHeader
        title="Family settings"
        description={`Child sign-in code: ${family.childLoginCode}`}
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Household</CardTitle>
        </CardHeader>
        <CardContent>
          {ctx.role === "OWNER" ? (
            <FamilySettingsForm
              family={{
                name: family.name,
                timezone: family.timezone,
                weekStartsOn: family.weekStartsOn,
                defaultApprovalPolicy: family.settings?.defaultApprovalPolicy ?? "PARENT_REVIEW",
                allowChildSelfSignIn: family.settings?.allowChildSelfSignIn ?? true,
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Only the family owner can change these settings.
            </p>
          )}
        </CardContent>
      </Card>
      {ctx.role === "OWNER" ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Child sign-in code</CardTitle>
          </CardHeader>
          <CardContent>
            <RotateFamilyCodeForm />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adults in this family</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {family.members.map((m) => (
              <li key={m.id} className="flex justify-between py-1.5">
                <span>
                  {m.user.name} <span className="text-muted-foreground">({m.user.email})</span>
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {m.role.toLowerCase()}
                  {ctx.role === "OWNER" && m.role !== "OWNER" ? (
                    <RemoveGuardianButton memberId={m.id} name={m.user.name} />
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {ctx.role === "OWNER" ? (
            <div className="mt-4 space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold">Invite another adult</h3>
              <InviteGuardianForm />
              {invitations.length > 0 ? (
                <ul className="divide-y text-sm" data-testid="pending-invitations">
                  {invitations.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between py-1.5">
                      <span>
                        {inv.email}{" "}
                        <span className="text-muted-foreground">
                          {inv.expired
                            ? "(expired)"
                            : `(expires ${inv.expiresAt.toISOString().slice(0, 10)})`}
                        </span>
                      </span>
                      <RevokeInvitationButton invitationId={inv.id} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Only the family owner can invite or remove adults.
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Your sign-ins</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Lost a phone or used a shared computer? This signs your account out on every device,
            including this one. Children&apos;s sessions are not affected.
          </p>
          <SignOutEverywhereButton />
        </CardContent>
      </Card>
    </>
  );
}
