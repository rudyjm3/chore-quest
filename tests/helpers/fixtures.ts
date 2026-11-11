import type { PrismaClient } from "@/generated/prisma/client";
import { hashPin } from "@/lib/auth/pin";
import { localDateToDb, type LocalDate } from "@/lib/utils/dates";
import type { ChildContext, ParentContext } from "@/server/policies/context";
import { generateFamilyCode } from "@/server/services/family.service";

let counter = 0;

/** Create a user + family + owner membership directly (bypasses Better Auth HTTP). */
export async function createFamilyFixture(
  db: PrismaClient,
  options: { timezone?: string; weekStartsOn?: number; name?: string } = {},
) {
  counter += 1;
  const user = await db.user.create({
    data: { name: `Parent ${counter}`, email: `parent${counter}-${Date.now()}@example.test` },
  });
  const family = await db.family.create({
    data: {
      name: options.name ?? `Family ${counter}`,
      timezone: options.timezone ?? "America/New_York",
      weekStartsOn: options.weekStartsOn ?? 1,
      childLoginCode: generateFamilyCode(),
      createdById: user.id,
      settings: { create: {} },
      members: { create: { userId: user.id, role: "OWNER" } },
    },
    include: { members: true, settings: true },
  });
  const ctx: ParentContext = {
    kind: "parent",
    userId: user.id,
    userName: user.name,
    familyId: family.id,
    familyName: family.name,
    timezone: family.timezone,
    weekStartsOn: family.weekStartsOn,
    role: "OWNER",
    membershipId: family.members[0].id,
  };
  return { user, family, ctx };
}

export async function createChildFixture(
  db: PrismaClient,
  familyId: string,
  name = "Kid",
  pin = "1234",
) {
  const child = await db.child.create({
    data: { familyId, displayName: name, credential: { create: { pinHash: await hashPin(pin) } } },
  });
  const ctx: ChildContext = {
    kind: "child",
    childId: child.id,
    childName: child.displayName,
    familyId,
    sessionId: "test",
  };
  return { child, ctx };
}

export async function createTaskFixture(
  db: PrismaClient,
  familyId: string,
  data: {
    title?: string;
    points?: number;
    category?: "CHORE" | "HYGIENE" | "SCHOOL" | "PET_CARE" | "HELPING" | "OTHER";
    approvalPolicy?: "PARENT_REVIEW" | "AUTO_APPROVE";
  } = {},
) {
  return db.task.create({
    data: {
      familyId,
      title: data.title ?? "Make Bed",
      points: data.points ?? 5,
      category: data.category ?? "CHORE",
      approvalPolicy: data.approvalPolicy ?? "PARENT_REVIEW",
    },
  });
}

/** Create a DAILY assignment and one occurrence on `localDate`. */
export async function createOccurrenceFixture(
  db: PrismaClient,
  params: {
    familyId: string;
    childId: string;
    taskId: string;
    localDate: LocalDate;
    points?: number;
  },
) {
  const assignment = await db.taskAssignment.create({
    data: {
      familyId: params.familyId,
      taskId: params.taskId,
      childId: params.childId,
      frequency: "DAILY",
      startDate: localDateToDb(params.localDate),
    },
  });
  const occurrence = await db.taskOccurrence.create({
    data: {
      familyId: params.familyId,
      assignmentId: assignment.id,
      childId: params.childId,
      localDate: localDateToDb(params.localDate),
      pointsSnapshot: params.points ?? 5,
    },
  });
  return { assignment, occurrence };
}
