import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";

/** Liveness + database reachability. Safe to expose; returns no data. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "ok" });
  } catch {
    return NextResponse.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
