/**
 * Seeds a demo church so Phase 1/2 flows have something to exercise end to
 * end: the default permission matrix, one church (Kharis Bristol), one
 * campus, a Production ministry with a Production Team, and a Church Admin
 * user.
 *
 * Run with: npm run seed --workspace packages/db
 */
import { PrismaClient, ChurchRole } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

// Default permission matrix — mirrors 02-architecture.md §4 / PRD §3.
// churchId is null for these rows: they are platform-wide defaults. A church
// can later override specific (role, resource, action) tuples by inserting a
// row with its own churchId, which PermissionGuard checks first.
const DEFAULT_PERMISSIONS: Array<{
  role: ChurchRole;
  resource: string;
  action: string;
}> = [
  ...["church", "campus", "ministry", "team", "volunteer", "service"].flatMap((resource) =>
    ["read", "write", "delete"].map((action) => ({
      role: ChurchRole.CHURCH_ADMIN,
      resource,
      action,
    })),
  ),
  ...["campus", "ministry", "team", "volunteer", "service"].flatMap((resource) =>
    ["read", "write"].map((action) => ({
      role: ChurchRole.CAMPUS_ADMIN,
      resource,
      action,
    })),
  ),
  { role: ChurchRole.MINISTRY_LEADER, resource: "ministry", action: "read" },
  { role: ChurchRole.MINISTRY_LEADER, resource: "team", action: "read" },
  { role: ChurchRole.MINISTRY_LEADER, resource: "team", action: "write" },
  { role: ChurchRole.MINISTRY_LEADER, resource: "volunteer", action: "read" },
  { role: ChurchRole.MINISTRY_LEADER, resource: "volunteer", action: "write" },
  { role: ChurchRole.MINISTRY_LEADER, resource: "service", action: "read" },
  { role: ChurchRole.MINISTRY_LEADER, resource: "service", action: "write" },
  { role: ChurchRole.TEAM_LEADER, resource: "team", action: "read" },
  { role: ChurchRole.TEAM_LEADER, resource: "service", action: "read" },
  { role: ChurchRole.TEAM_LEADER, resource: "volunteer", action: "read" },
  { role: ChurchRole.VOLUNTEER, resource: "team", action: "read" },
  { role: ChurchRole.VOLUNTEER, resource: "service", action: "read" },
  { role: ChurchRole.VOLUNTEER, resource: "volunteer", action: "read" },
  { role: ChurchRole.GUEST, resource: "service", action: "read" },
];

async function main() {
  console.log("Seeding default permission matrix...");
  for (const perm of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: {
        churchId_role_resource_action: {
          churchId: null,
          role: perm.role,
          resource: perm.resource,
          action: perm.action,
        },
      },
      update: { allowed: true },
      create: { ...perm, allowed: true, churchId: null },
    });
  }

  console.log("Seeding Kharis Bristol...");
  const church = await prisma.church.upsert({
    where: { slug: "kharis-bristol" },
    update: {},
    create: {
      name: "Kharis Bristol",
      slug: "kharis-bristol",
      timezone: "Europe/London",
      primaryColor: "#4F46E5",
    },
  });

  let campus = await prisma.campus.findFirst({
    where: { churchId: church.id, isPrimary: true },
  });
  if (!campus) {
    campus = await prisma.campus.create({
      data: { churchId: church.id, name: "Main Campus", isPrimary: true },
    });
  }

  let productionMinistry = await prisma.ministry.findFirst({
    where: { churchId: church.id, name: "Production" },
  });
  if (!productionMinistry) {
    productionMinistry = await prisma.ministry.create({
      data: {
        churchId: church.id,
        campusId: campus.id,
        name: "Production",
        category: "PRODUCTION",
        description: "Sound, lighting, streaming, and stage production for services.",
      },
    });
  }

  const productionTeam = await prisma.team.findFirst({
    where: { ministryId: productionMinistry.id, name: "Production Team" },
  });
  if (!productionTeam) {
    await prisma.team.create({
      data: { ministryId: productionMinistry.id, name: "Production Team" },
    });
  }

  const passwordHash = await argon2.hash("ChangeMe123!");
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@kharisbristol.test" },
    update: {},
    create: {
      email: "admin@kharisbristol.test",
      firstName: "Kharis",
      lastName: "Admin",
      passwordHash,
    },
  });

  const existingMembership = await prisma.membership.findFirst({
    where: {
      userId: adminUser.id,
      churchId: church.id,
      campusId: null,
      ministryId: null,
      role: ChurchRole.CHURCH_ADMIN,
    },
  });
  if (!existingMembership) {
    await prisma.membership.create({
      data: {
        userId: adminUser.id,
        churchId: church.id,
        role: ChurchRole.CHURCH_ADMIN,
      },
    });
  }

  console.log("Seed complete:");
  console.log(`  Church: ${church.name} (${church.id})`);
  console.log(`  Campus: ${campus.name} (${campus.id})`);
  console.log(`  Ministry: ${productionMinistry.name} > Production Team`);
  console.log(`  Admin login: admin@kharisbristol.test / ChangeMe123!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
