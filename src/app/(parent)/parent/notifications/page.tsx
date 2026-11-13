import { PageHeader } from "@/components/shared/page-header";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { prisma } from "@/lib/db/prisma";
import { uuidSchema } from "@/lib/validation/common";
import { requireParentContext } from "@/server/policies/context";
import { listNotifications } from "@/server/services/notification.service";

export const metadata = { title: "Notifications" };

function parentLink(entityType: string | null) {
  if (entityType === "RewardRedemption") return "/parent/rewards";
  if (entityType === "TaskOccurrence" || entityType === "RoutineRun") return "/parent/approvals";
  return null;
}

export default async function ParentNotificationsPage({
  searchParams,
}: PageProps<"/parent/notifications">) {
  const ctx = await requireParentContext();
  const { cursor } = await searchParams;
  const parsed = uuidSchema.safeParse(typeof cursor === "string" ? cursor : undefined);
  const page = await listNotifications(prisma, ctx, {
    cursor: parsed.success ? parsed.data : undefined,
  });
  return (
    <>
      <PageHeader
        title="Notifications"
        description="New things to review and reward requests. These stay in the app: no email or push messages are sent."
      />
      <NotificationList
        page={page}
        variant="parent"
        basePath="/parent/notifications"
        linkFor={(entityType) => parentLink(entityType)}
      />
    </>
  );
}
