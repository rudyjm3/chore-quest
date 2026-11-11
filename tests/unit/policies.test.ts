import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import type { ChildContext, ParentContext } from "@/server/policies/context";
import {
  assertChild,
  assertFamilyScope,
  assertOwnChild,
  assertParent,
  assertPermission,
  parentPermissions,
} from "@/server/policies/family-access";

const parent: ParentContext = {
  kind: "parent",
  userId: "u1",
  userName: "P",
  familyId: "f1",
  familyName: "F",
  timezone: "UTC",
  weekStartsOn: 1,
  role: "GUARDIAN",
  membershipId: "m1",
};
const child: ChildContext = {
  kind: "child",
  childId: "c1",
  childName: "C",
  familyId: "f1",
  sessionId: "s1",
};

describe("authorization policies", () => {
  it("blocks cross-family access", () => {
    expect(() => assertFamilyScope(parent, "f1")).not.toThrow();
    expect(() => assertFamilyScope(parent, "f2")).toThrow(AppError);
    expect(() => assertFamilyScope(child, "f2")).toThrow(/another family/);
  });

  it("distinguishes parent and child actors", () => {
    expect(() => assertParent(child)).toThrow(/Parent access/);
    expect(() => assertChild(parent)).toThrow(/Child access/);
    expect(() => assertOwnChild(child, "c2")).toThrow(/own activities/);
  });

  it("guardians can approve but cannot manage the family", () => {
    expect(parentPermissions.canApprove("GUARDIAN")).toBe(true);
    expect(parentPermissions.canManageFamily("GUARDIAN")).toBe(false);
    expect(parentPermissions.canManageFamily("OWNER")).toBe(true);
    expect(() => assertPermission(parent, "canManageFamily")).toThrow(/cannot perform/);
    expect(() => assertPermission({ ...parent, role: "OWNER" }, "canManageFamily")).not.toThrow();
  });

  it("AppError maps codes to HTTP status", () => {
    expect(AppError.forbidden().status).toBe(403);
    expect(AppError.notFound("X").message).toBe("X not found");
  });
});
