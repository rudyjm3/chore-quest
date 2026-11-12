import { notFound } from "next/navigation";

import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dev outbox" };

/** Local development only: lists mail captured by the dev email driver. 404 in production. */
export default async function DevOutboxPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const messages = await prisma.emailOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-bold">Dev outbox (latest 20)</h1>
      {messages.length === 0 ? <p>No mail captured yet.</p> : null}
      {messages.map((m) => (
        <article key={m.id} className="rounded-lg border p-3 text-sm">
          <p className="font-medium">
            {m.subject} <span className="text-muted-foreground">→ {m.toAddress}</span>
          </p>
          <pre className="mt-2 whitespace-pre-wrap">{m.textBody}</pre>
        </article>
      ))}
    </main>
  );
}
