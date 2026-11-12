import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FamilySettingsForm,
  RotateFamilyCodeForm,
} from "@/features/families/components/family-forms";
import { prisma } from "@/lib/db/prisma";
import { requireParentContext } from "@/server/policies/context";
import { getFamilyOverview } from "@/server/services/family.service";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireParentContext();
  const family = await getFamilyOverview(prisma, ctx);
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
                <span className="text-muted-foreground">{m.role.toLowerCase()}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Inviting another guardian by email is planned for the Family Management milestone.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
