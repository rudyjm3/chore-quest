/**
 * DEVELOPMENT-ONLY demo household. Refuses to run when NODE_ENV=production.
 *
 *   pnpm db:seed:dev
 *
 * Creates (idempotently, keyed by the demo parent's email):
 *   - parent user  demo.parent@chorequests.local / DemoPassword123!
 *   - family "The Demo Crew" (child login code printed at the end)
 *   - children Ava (PIN 1234) and Max (PIN 5678)
 *   - a few tasks, a morning routine, a weekly goal, and the pirate adventure
 */
import "dotenv/config";

import { pirateAdventure } from "../src/game/themes/pirate";
import { auth } from "../src/lib/auth/auth";
import { hashPin } from "../src/lib/auth/pin";
import { prisma } from "../src/lib/db/prisma";
import { todayIn } from "../src/lib/utils/dates";
import { startAdventure } from "../src/server/services/adventure.service";
import { generateFamilyCode } from "../src/server/services/family.service";
import { ensureRoutineRuns } from "../src/server/services/routine.service";
import { ensureTaskOccurrences } from "../src/server/services/task.service";
import { seedReferenceData } from "./seed";

export const DEMO_PARENT = {
  email: "demo.parent@chorequests.local",
  password: "DemoPassword123!",
  name: "Demo Parent",
};
export const DEMO_CHILDREN = [
  { displayName: "Ava", pin: "1234", avatarKey: "avatar.fox" },
  { displayName: "Max", pin: "5678", avatarKey: "avatar.owl" },
];
export const DEMO_TIMEZONE = "America/New_York";

export async function seedDemoFamily() {
  if (process.env.NODE_ENV === "production")
    throw new Error("seed-dev must never run in production");
  await seedReferenceData();

  let user = await prisma.user.findUnique({ where: { email: DEMO_PARENT.email } });
  if (!user) {
    await auth.api.signUpEmail({
      body: { email: DEMO_PARENT.email, password: DEMO_PARENT.password, name: DEMO_PARENT.name },
    });
    user = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_PARENT.email } });
  }
  // The demo parent signs in without opening a verification email.
  if (!user.emailVerified) {
    user = await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  }

  let family = await prisma.family.findFirst({
    where: { createdById: user.id },
    include: { children: true },
  });
  if (!family) {
    family = await prisma.family.create({
      data: {
        name: "The Demo Crew",
        timezone: DEMO_TIMEZONE,
        weekStartsOn: 1,
        childLoginCode: generateFamilyCode(),
        createdById: user.id,
        settings: { create: {} },
        members: { create: { userId: user.id, role: "OWNER" } },
      },
      include: { children: true },
    });
  }

  const children = [] as Array<{ id: string; displayName: string }>;
  for (const demo of DEMO_CHILDREN) {
    let child = family.children.find((c) => c.displayName === demo.displayName) ?? null;
    if (!child) {
      child = await prisma.child.create({
        data: {
          familyId: family.id,
          displayName: demo.displayName,
          avatarKey: demo.avatarKey,
          credential: { create: { pinHash: await hashPin(demo.pin) } },
        },
      });
    }
    children.push(child);
  }
  // Re-running the dev seed restores a clean demo state: no PIN lockouts left over from testing.
  await prisma.childCredential.updateMany({
    where: { childId: { in: children.map((c) => c.id) } },
    data: { failedAttempts: 0, lockedUntil: null },
  });

  // Tasks from presets
  const presets = await prisma.taskPreset.findMany({
    where: { key: { in: ["make-bed", "brush-teeth", "feed-pet", "complete-homework"] } },
  });
  const tasks = [] as Array<{ id: string; title: string }>;
  for (const preset of presets) {
    const existing = await prisma.task.findFirst({
      where: { familyId: family.id, presetId: preset.id },
    });
    tasks.push(
      existing ??
        (await prisma.task.create({
          data: {
            familyId: family.id,
            presetId: preset.id,
            title: preset.title,
            description: preset.description,
            category: preset.category,
            iconKey: preset.iconKey,
            points: preset.defaultPoints,
            createdById: user.id,
          },
        })),
    );
  }

  const today = todayIn(DEMO_TIMEZONE);
  for (const child of children) {
    for (const task of tasks.slice(0, 3)) {
      const existing = await prisma.taskAssignment.findFirst({
        where: { taskId: task.id, childId: child.id },
      });
      if (!existing) {
        await prisma.taskAssignment.create({
          data: {
            familyId: family.id,
            taskId: task.id,
            childId: child.id,
            frequency: "DAILY",
            startDate: new Date(`${today}T00:00:00Z`),
          },
        });
      }
    }
  }

  // Morning routine
  let routine = await prisma.routine.findFirst({
    where: { familyId: family.id, name: "Morning Routine" },
  });
  if (!routine) {
    routine = await prisma.routine.create({
      data: {
        familyId: family.id,
        name: "Morning Routine",
        iconKey: "routine.morning",
        steps: { create: tasks.slice(0, 2).map((t, i) => ({ taskId: t.id, sortOrder: i + 1 })) },
      },
    });
  }
  for (const child of children) {
    await prisma.routineAssignment.upsert({
      where: { routineId_childId: { routineId: routine.id, childId: child.id } },
      create: {
        familyId: family.id,
        routineId: routine.id,
        childId: child.id,
        frequency: "DAILY",
        startDate: new Date(`${today}T00:00:00Z`),
        bonusPoints: 5,
      },
      update: {},
    });
  }

  // Weekly goal
  let goal = await prisma.goal.findFirst({
    where: { familyId: family.id, title: "Complete 10 chores this week" },
  });
  if (!goal) {
    goal = await prisma.goal.create({
      data: {
        familyId: family.id,
        title: "Complete 10 chores this week",
        type: "WEEKLY_COUNT",
        targetCount: 10,
        recurrence: "WEEKLY",
        rewardPoints: 20,
        createdById: user.id,
      },
    });
  }

  await ensureTaskOccurrences(prisma, { familyId: family.id, from: today, to: today });
  await ensureRoutineRuns(prisma, { familyId: family.id, from: today, to: today });
  for (const child of children) {
    await startAdventure(prisma, {
      familyId: family.id,
      childId: child.id,
      adventureKey: pirateAdventure.key,
    });
  }

  return {
    familyId: family.id,
    familyCode: family.childLoginCode,
    children: children.map((c) => c.displayName),
  };
}

const isDirectRun = process.argv[1]?.endsWith("seed-dev.ts");
if (isDirectRun) {
  seedDemoFamily()
    .then((result) => {
      console.log("Demo family ready:", result);
      console.log(`Parent login: ${DEMO_PARENT.email} / ${DEMO_PARENT.password}`);
      console.log(`Child login code: ${result.familyCode} (Ava PIN 1234, Max PIN 5678)`);
    })
    .catch((error) => {
      console.error("Dev seed failed:", error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
