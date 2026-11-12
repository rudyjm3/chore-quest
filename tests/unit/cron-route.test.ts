import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/server/services/maintenance.service", () => ({
  runScheduledMaintenance: vi.fn(async () => ({ families: 0 })),
}));

import { GET } from "@/app/api/cron/maintenance/route";

const URL_ = "http://localhost/api/cron/maintenance";
afterEach(() => vi.unstubAllEnvs());

describe("cron maintenance route auth", () => {
  it("is disabled (503) when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(new NextRequest(URL_))).status).toBe(503);
  });
  it("rejects missing or wrong bearer tokens", async () => {
    vi.stubEnv("CRON_SECRET", "a-secret-of-sufficient-length");
    expect((await GET(new NextRequest(URL_))).status).toBe(401);
    const wrong = new NextRequest(URL_, { headers: { authorization: "Bearer nope" } });
    expect((await GET(wrong)).status).toBe(401);
  });
  it("runs with the correct bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "a-secret-of-sufficient-length");
    const ok = new NextRequest(URL_, {
      headers: { authorization: "Bearer a-secret-of-sufficient-length" },
    });
    const res = await GET(ok);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});
