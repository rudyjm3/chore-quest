import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  createDevEmailSender,
  extractLink,
  latestOutboxMessage,
  pruneOutbox,
} from "@/lib/email/dev-driver";
import type { EmailSender } from "@/lib/email";
import {
  acceptInvitation,
  createInvitation,
  hashInvitationToken,
  listOpenInvitations,
  previewInvitation,
  removeGuardian,
  revokeInvitation,
} from "@/server/services/invitation.service";
import { runScheduledMaintenance } from "@/server/services/maintenance.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import { createFamilyFixture } from "../helpers/fixtures";

const db: PrismaClient = testDb();
const sender = createDevEmailSender(db);
const APP = "http://localhost:3100";

beforeEach(async () => {
  await resetHouseholdData(db);
  await db.emailOutbox.deleteMany();
});
afterAll(() => disconnectTestDb());

async function invite(
  f: Awaited<ReturnType<typeof createFamilyFixture>>,
  email: string,
  now?: Date,
) {
  const result = await createInvitation(db, f.ctx, { email, appUrl: APP, sender, now });
  const token = result.url.split("/invite/")[1];
  return { ...result, token };
}

async function newUser(email: string) {
  return db.user.create({ data: { name: "Invitee", email } });
}

describe("guardian invitations", () => {
  it("stores only a hash, emails a link, and audits without the address", async () => {
    const f = await createFamilyFixture(db);
    const { invitation, token, emailSent } = await invite(f, "  Grandma@Example.test ");
    expect(emailSent).toBe(true);
    expect(invitation.email).toBe("grandma@example.test");
    expect(invitation.tokenHash).toBe(hashInvitationToken(token));
    expect(invitation.tokenHash).not.toContain(token);
    expect(JSON.stringify(await db.familyInvitation.findMany())).not.toContain(token);
    const mail = await latestOutboxMessage(db, "grandma@example.test", "guardian-invite");
    expect(extractLink(mail?.textBody ?? "")).toBe(`${APP}/invite/${token}`);
    const audit = await db.auditLog.findFirstOrThrow({
      where: { action: "family.invitation.create" },
    });
    expect(JSON.stringify(audit)).not.toContain("grandma");
    expect(await previewInvitation(db, token)).toEqual({ familyName: f.family.name });
  });

  it("accepting creates a GUARDIAN membership, is single use, and is audited", async () => {
    const f = await createFamilyFixture(db);
    const { token } = await invite(f, "guest@example.test");
    const guest = await newUser("guest@example.test");
    const { familyId } = await acceptInvitation(db, {
      userId: guest.id,
      userEmail: guest.email,
      token,
    });
    expect(familyId).toBe(f.family.id);
    const member = await db.familyMember.findFirstOrThrow({ where: { userId: guest.id } });
    expect(member).toMatchObject({ role: "GUARDIAN", status: "ACTIVE" });
    await expect(
      acceptInvitation(db, { userId: guest.id, userEmail: guest.email, token }),
    ).rejects.toThrow(/not found/i);
    expect(await previewInvitation(db, token)).toBeNull();
    expect(await db.auditLog.count({ where: { action: "family.invitation.accept" } })).toBe(1);
  });

  it("concurrent accepts: exactly one succeeds", async () => {
    const f = await createFamilyFixture(db);
    const { token } = await invite(f, "race@example.test");
    const user = await newUser("race@example.test");
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        acceptInvitation(db, { userId: user.id, userEmail: user.email, token }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.familyMember.count({ where: { userId: user.id } })).toBe(1);
  });

  it("rejects expired, revoked, wrong-email and unknown tokens", async () => {
    const f = await createFamilyFixture(db);
    const past = new Date(Date.now() - 8 * 86_400_000);
    const old = await invite(f, "late@example.test", past);
    const late = await newUser("late@example.test");
    await expect(
      acceptInvitation(db, { userId: late.id, userEmail: late.email, token: old.token }),
    ).rejects.toThrow(/not found/i);
    expect(await previewInvitation(db, old.token)).toBeNull();

    const revoked = await invite(f, "gone@example.test");
    await revokeInvitation(db, f.ctx, revoked.invitation.id);
    const gone = await newUser("gone@example.test");
    await expect(
      acceptInvitation(db, { userId: gone.id, userEmail: gone.email, token: revoked.token }),
    ).rejects.toThrow(/not found/i);

    const bound = await invite(f, "right@example.test");
    const wrong = await newUser("wrong@example.test");
    await expect(
      acceptInvitation(db, { userId: wrong.id, userEmail: wrong.email, token: bound.token }),
    ).rejects.toThrow(/different email/i);
    expect(await db.familyMember.count({ where: { userId: wrong.id } })).toBe(0);
    await expect(
      acceptInvitation(db, { userId: wrong.id, userEmail: wrong.email, token: "x".repeat(43) }),
    ).rejects.toThrow(/not found/i);
  });

  it("re-inviting revokes the previous link; only OWNER can invite, list, revoke or remove", async () => {
    const f = await createFamilyFixture(db);
    const first = await invite(f, "again@example.test");
    const second = await invite(f, "again@example.test");
    expect(await previewInvitation(db, first.token)).toBeNull();
    expect(await previewInvitation(db, second.token)).not.toBeNull();
    expect(await listOpenInvitations(db, f.ctx)).toHaveLength(1);

    const guardianCtx = { ...f.ctx, role: "GUARDIAN" as const };
    await expect(
      createInvitation(db, guardianCtx, { email: "x@example.test", appUrl: APP, sender }),
    ).rejects.toThrow();
    await expect(listOpenInvitations(db, guardianCtx)).rejects.toThrow();
    await expect(revokeInvitation(db, guardianCtx, second.invitation.id)).rejects.toThrow();
  });

  it("cannot invite an existing member, nor revoke another family's invitation", async () => {
    const a = await createFamilyFixture(db);
    const b = await createFamilyFixture(db);
    await expect(
      createInvitation(db, a.ctx, { email: a.user.email, appUrl: APP, sender }),
    ).rejects.toThrow(/already/i);
    const inv = await invite(a, "someone@example.test");
    await expect(revokeInvitation(db, b.ctx, inv.invitation.id)).rejects.toThrow(/not found/i);
  });

  it("caps open invitations and survives a failing mail sender", async () => {
    const f = await createFamilyFixture(db);
    const failing: EmailSender = {
      send: async () => {
        throw new Error("smtp down");
      },
    };
    const res = await createInvitation(db, f.ctx, {
      email: "f@example.test",
      appUrl: APP,
      sender: failing,
    });
    expect(res.emailSent).toBe(false);
    expect(res.url).toContain("/invite/");
    for (let i = 0; i < 9; i += 1) await invite(f, `p${i}@example.test`);
    await expect(invite(f, "overflow@example.test")).rejects.toThrow(/too many/i);
  });

  it("removing a guardian ends their access; the owner cannot be removed", async () => {
    const f = await createFamilyFixture(db);
    const { token } = await invite(f, "temp@example.test");
    const temp = await newUser("temp@example.test");
    await acceptInvitation(db, { userId: temp.id, userEmail: temp.email, token });
    const member = await db.familyMember.findFirstOrThrow({ where: { userId: temp.id } });
    await removeGuardian(db, f.ctx, member.id);
    expect((await db.familyMember.findUniqueOrThrow({ where: { id: member.id } })).status).toBe(
      "REMOVED",
    );
    await expect(removeGuardian(db, f.ctx, f.ctx.membershipId)).rejects.toThrow(/owner/i);
    const other = await createFamilyFixture(db);
    await expect(removeGuardian(db, other.ctx, member.id)).rejects.toThrow(/not found/i);
    // A removed guardian can be invited again and regains access.
    const again = await invite(f, "temp@example.test");
    await acceptInvitation(db, { userId: temp.id, userEmail: temp.email, token: again.token });
    expect((await db.familyMember.findUniqueOrThrow({ where: { id: member.id } })).status).toBe(
      "ACTIVE",
    );
  });

  it("prunes old dev mail in the maintenance job", async () => {
    await sender.send({ kind: "verify-email", to: "a@example.test", subject: "s", text: "t" });
    await db.emailOutbox.updateMany({
      data: { createdAt: new Date(Date.now() - 10 * 86_400_000) },
    });
    await sender.send({ kind: "verify-email", to: "b@example.test", subject: "s", text: "t" });
    expect(await pruneOutbox(db)).toBe(1);
    await db.emailOutbox.updateMany({
      data: { createdAt: new Date(Date.now() - 10 * 86_400_000) },
    });
    const summary = await runScheduledMaintenance(db);
    expect(summary.outboxPruned).toBe(1);
  });
});
