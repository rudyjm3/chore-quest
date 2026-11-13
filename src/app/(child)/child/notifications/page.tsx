import { NotificationList } from "@/features/notifications/components/notification-list";
import { prisma } from "@/lib/db/prisma";
import { uuidSchema } from "@/lib/validation/common";
import { requireChildContext } from "@/server/policies/context";
import { listNotifications } from "@/server/services/notification.service";

export const metadata = { title: "News" };

function childLink(entityType: string | null) {
  if (entityType === "RewardRedemption") return "/child/rewards";
  if (entityType === "TaskOccurrence" || entityType === "RoutineRun") return "/child";
  return null;
}

export default async function ChildNotificationsPage({
  searchParams,
}: PageProps<"/child/notifications">) {
  const ctx = await requireChildContext();
  const { cursor } = await searchParams;
  const parsed = uuidSchema.safeParse(typeof cursor === "string" ? cursor : undefined);
  const page = await listNotifications(prisma, ctx, {
    cursor: parsed.success ? parsed.data : undefined,
  });
  const family = await prisma.family.findUniqueOrThrow({
    where: { id: ctx.familyId },
    select: { timezone: true },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">News from the crew</h1>
      <NotificationList
        page={page}
        variant="child"
        basePath="/child/notifications"
        timeZone={family.timezone}
        linkFor={(entityType) => childLink(entityType)}
      />
    </div>
  );
}
