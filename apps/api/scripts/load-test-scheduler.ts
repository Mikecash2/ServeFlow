/**
 * One-off load test for the AI scheduling engine (docs/08-roadmap.md Phase 11:
 * "load test the scheduling engine at target scale — thousands of churches,
 * largest church ~500 volunteers"). Not part of the routine test suite (it's
 * slow and its point is a timing measurement, not a pass/fail assertion) —
 * run manually with:
 *
 *   DATABASE_URL=... JWT_ACCESS_SECRET=x JWT_REFRESH_SECRET=x \
 *     npx ts-node --transpile-only scripts/load-test-scheduler.ts
 *
 * Seeds one church at the documented "largest church" scale — 500 active
 * volunteers spread across 5 ministries — and a service with 15 roles (the
 * upper end of the "typical service" range from docs/04-ai-scheduling-algorithm.md
 * §9), then times a real SchedulingService.generateSchedule() call.
 */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import * as argon2 from "argon2";
import { AppModule } from "../src/app.module";
import { DatabaseService } from "../src/database/database.service";
import { SchedulingService } from "../src/modules/scheduling/scheduling.service";

const CHURCH_NAME = "Load Test Church";
const MINISTRY_COUNT = 5;
const VOLUNTEERS_PER_MINISTRY = 100; // 500 total, matching the "largest church" target
const ROLES_PER_SERVICE = 15;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const db = app.get(DatabaseService);
  const scheduling = app.get(SchedulingService);

  console.log(`Seeding ${CHURCH_NAME}: ${MINISTRY_COUNT} ministries x ${VOLUNTEERS_PER_MINISTRY} volunteers = ${MINISTRY_COUNT * VOLUNTEERS_PER_MINISTRY} volunteers, ${ROLES_PER_SERVICE} roles on one service...`);
  const seedStart = Date.now();

  const [church] = await db.query<{ id: string }>(
    `insert into churches (name, slug, timezone) values ($1, $2, 'UTC') returning id`,
    [CHURCH_NAME, `load-test-${Date.now()}`],
  );
  const [campus] = await db.query<{ id: string }>(
    `insert into campuses (church_id, name, is_primary) values ($1, 'Main Campus', true) returning id`,
    [church.id],
  );
  const [adminUser] = await db.query<{ id: string }>(
    `insert into users (email, first_name, last_name, password_hash) values ($1, 'Load', 'Test', $2) returning id`,
    [`admin-${Date.now()}@loadtest.example.com`, await argon2.hash("LoadTest123!")],
  );
  await db.query(`insert into memberships (user_id, church_id, role) values ($1, $2, 'CHURCH_ADMIN')`, [
    adminUser.id,
    church.id,
  ]);

  const serviceDate = "2026-08-02T09:00:00.000Z";
  const [service] = await db.query<{ id: string }>(
    `insert into services (church_id, campus_id, type, title, date, service_start)
     values ($1, $2, 'SUNDAY_SERVICE', 'Load Test Service', $3, $3) returning id`,
    [church.id, campus.id, serviceDate],
  );

  const ministryIds: string[] = [];
  for (let m = 0; m < MINISTRY_COUNT; m++) {
    const [ministry] = await db.query<{ id: string }>(
      `insert into ministries (church_id, campus_id, name, category) values ($1, $2, $3, 'PRODUCTION') returning id`,
      [church.id, campus.id, `Ministry ${m + 1}`],
    );
    ministryIds.push(ministry.id);

    for (let v = 0; v < VOLUNTEERS_PER_MINISTRY; v++) {
      const [user] = await db.query<{ id: string }>(
        `insert into users (email, first_name, last_name) values ($1, $2, 'Volunteer') returning id`,
        [`vol-${m}-${v}-${Date.now()}@loadtest.example.com`, `V${m}_${v}`],
      );
      await db.query(`insert into memberships (user_id, church_id, ministry_id, role) values ($1, $2, $3, 'VOLUNTEER')`, [
        user.id,
        church.id,
        ministry.id,
      ]);
      const [profile] = await db.query<{ id: string }>(
        `insert into volunteer_profiles (user_id, church_id, status) values ($1, $2, 'ACTIVE') returning id`,
        [user.id, church.id],
      );
      await db.query(`insert into availability (volunteer_profile_id, date, status) values ($1, $2::date, 'AVAILABLE')`, [
        profile.id,
        serviceDate,
      ]);
    }
  }

  for (let r = 0; r < ROLES_PER_SERVICE; r++) {
    const ministryId = ministryIds[r % ministryIds.length];
    await db.query(
      `insert into service_roles (service_id, ministry_id, name, min_required, max_allowed) values ($1, $2, $3, 1, 1)`,
      [service.id, ministryId, `Role ${r + 1}`],
    );
  }

  console.log(`Seed complete in ${Date.now() - seedStart}ms.`);
  console.log("Running generateSchedule()...");

  const runStart = Date.now();
  const result = await scheduling.generateSchedule(church.id, service.id, adminUser.id);
  const elapsedMs = Date.now() - runStart;

  console.log(`\n=== Load test result ===`);
  console.log(`Volunteers: ${MINISTRY_COUNT * VOLUNTEERS_PER_MINISTRY}`);
  console.log(`Roles: ${ROLES_PER_SERVICE}`);
  console.log(`generateSchedule() elapsed: ${elapsedMs}ms`);
  console.log(`Coverage: ${result.coveragePct}%`);
  console.log(`Assignments made: ${result.assignments.length}`);
  console.log(`Target from docs/04-ai-scheduling-algorithm.md §9: <5000ms for large multi-role services. ${elapsedMs < 5000 ? "PASS" : "FAIL"}`);

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
