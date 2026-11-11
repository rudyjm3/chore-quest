import { ResourceCounter } from "@/components/shared/resource-counter";
import { StartAdventureButton } from "@/features/adventures/components/adventure-actions";
import { AdventureMap } from "@/features/adventures/components/adventure-map";
import { prisma } from "@/lib/db/prisma";
import { requireChildContext } from "@/server/policies/context";
import { getAdventureState } from "@/server/services/adventure.service";

export const metadata = { title: "Adventure" };
const ADVENTURE_KEY = "pirate";

export default async function AdventurePage() {
  const ctx = await requireChildContext();
  const state = await getAdventureState(prisma, ctx, ADVENTURE_KEY);
  const currentKey = state.chapters
    .filter((c) => c.status === "UNLOCKED" || c.status === "IN_PROGRESS")
    .at(-1)?.key;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-widest text-pirate-wood uppercase">
            Pirate Adventure
          </p>
          <h1 className="text-2xl font-black">{state.adventure.title}</h1>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ResourceCounter icon="🧭" label="Level" value={state.level} />
          <ResourceCounter
            icon="🗺️"
            label="Map fragments"
            value={state.inventory["map-fragment"] ?? 0}
          />
          <ResourceCounter
            icon="📦"
            label="Supply crates"
            value={state.inventory["supply-crate"] ?? 0}
          />
          <ResourceCounter
            icon="🪶"
            label="Compass feathers"
            value={state.inventory["compass-feather"] ?? 0}
          />
        </div>
      </div>
      {!state.started ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border-4 border-pirate-wood bg-pirate-parchment p-8 text-center">
          <p className="text-lg">The captain is looking for a crew. Ready to sail?</p>
          <StartAdventureButton adventureKey={ADVENTURE_KEY} />
        </div>
      ) : null}
      <AdventureMap
        themeKey={state.adventure.themeKey}
        chapters={state.chapters.map((c) => ({
          key: c.key,
          title: c.title,
          status: c.status,
          definitionStatus: c.definitionStatus,
          mapMarker: c.mapMarker,
          isCurrent: c.key === currentKey,
        }))}
      />
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="chapter-list">
        {state.chapters.map((c) => (
          <li
            key={c.key}
            className="rounded-2xl border-2 border-pirate-wood/30 bg-pirate-parchment px-4 py-3"
          >
            <p className="font-black">
              {c.sortOrder}. {c.title}
            </p>
            <p className="text-sm text-muted-foreground">{c.subtitle}</p>
            {c.status === "LOCKED" && c.missingRequirements.length > 0 ? (
              <p className="mt-1 text-xs">
                🔒{" "}
                {c.missingRequirements
                  .map((r) =>
                    r.type === "ITEM"
                      ? `Need ${r.quantity} ${r.itemKey.replaceAll("-", " ")}`
                      : r.type === "CHAPTER_COMPLETED"
                        ? `Finish ${r.chapterKey.replaceAll("-", " ")}`
                        : "Locked",
                  )
                  .join(" · ")}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
