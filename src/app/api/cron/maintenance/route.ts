import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { log } from "@/lib/logging";
import { runScheduledMaintenance } from "@/server/services/maintenance.service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Vercel Cron entry point (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
 * Fails closed: when CRON_SECRET is not configured the route is disabled (503), never open.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  }
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runScheduledMaintenance(prisma);
    log.info("maintenance.completed", { ...summary });
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    log.error("maintenance.failed", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Maintenance failed" }, { status: 500 });
  }
}
