import { prisma } from "@/lib/db/prisma";
import { requireChildContext } from "@/server/policies/context";
import { listAchievementGallery } from "@/server/services/achievement.service";

export const metadata = { title: "Badges" };

export default async function ChildAchievementsPage() {
  const ctx = await requireChildContext();
  const items = await listAchievementGallery(prisma, ctx);
  const earned = items.filter((i) => i.earned).length;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">My badges</h1>
      <p className="text-sm text-muted-foreground" data-testid="badge-count">
        {earned} of {items.length} found
      </p>
      {items.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-pirate-wood/40 p-6 text-center">
          No badges to find yet.
        </p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2" data-testid="achievement-gallery">
        {items.map((item) => (
          <li
            key={item.key}
            data-earned={item.earned ? "true" : "false"}
            className={
              item.earned
                ? "rounded-2xl border-2 border-pirate-gold bg-pirate-parchment p-4"
                : "rounded-2xl border-2 border-dashed border-pirate-wood/40 bg-muted/40 p-4"
            }
          >
            <p className="flex items-center gap-2 text-lg font-bold">
              <span aria-hidden className="text-2xl">
                {item.earned ? "🏅" : "🔒"}
              </span>
              {item.title}
              <span className="sr-only">{item.earned ? " (earned)" : " (locked)"}</span>
            </p>
            {item.earned ? (
              <>
                <p className="text-sm">{item.description}</p>
                {item.earnedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Earned {item.earnedAt.toISOString().slice(0, 10)}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Hint: {item.hint}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
