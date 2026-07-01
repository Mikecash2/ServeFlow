import { beforeAll, describe, expect, it } from "vitest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { HttpExceptionFilter } from "../../src/common/filters/http-exception.filter";
import { resetTestDatabase } from "./setup";

/**
 * Phase 9 exit criteria (docs/08-roadmap.md): the PRD's example assistant
 * questions return correct, scoped answers in a real dataset — not just
 * that the endpoint returns 200. Also covers the Analytics endpoints.
 */
describe("Analytics & AI Assistant integration", () => {
  let app: INestApplication;
  let churchId: string;
  let auth: { Authorization: string };
  let ministryId: string;
  let campusId: string;
  let volunteerA: string; // has the skill, completed training, served a past service
  let volunteerB: string; // lacks the skill, no training, never served
  let volunteerC: string; // has the skill at a higher level, no training

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
    process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";
    await resetTestDatabase();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix("v1", { exclude: ["health"] });
    await app.init();

    const registerRes = await request(app.getHttpServer())
      .post("/v1/auth/register")
      .send({ email: "admin-analytics@example.com", password: "SuperSecret123", firstName: "Admin", lastName: "User", churchName: "Kharis Bristol Analytics" })
      .expect(201);
    churchId = registerRes.body.user.memberships[0].churchId;
    auth = { Authorization: `Bearer ${registerRes.body.accessToken}` };

    const campusesRes = await request(app.getHttpServer()).get(`/v1/churches/${churchId}/campuses`).set(auth).expect(200);
    campusId = campusesRes.body[0].id;

    const ministryRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/ministries`)
      .set(auth)
      .send({ name: "Production", category: "PRODUCTION" })
      .expect(201);
    ministryId = ministryRes.body.id;

    async function makeVolunteer(email: string, firstName: string, skillLevel?: number, trained?: boolean) {
      const res = await request(app.getHttpServer())
        .post(`/v1/churches/${churchId}/volunteers`)
        .set(auth)
        .send({ email, firstName, lastName: "Operator" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/v1/churches/${churchId}/ministries/${ministryId}/volunteers/${res.body.id}`)
        .set(auth)
        .expect(201);
      if (skillLevel) {
        await request(app.getHttpServer())
          .post(`/v1/churches/${churchId}/volunteers/${res.body.id}/skills`)
          .set(auth)
          .send({ skillName: "Camera Operation", experienceLevel: skillLevel })
          .expect(201);
      }
      if (trained) {
        await request(app.getHttpServer())
          .post(`/v1/churches/${churchId}/volunteers/${res.body.id}/training`)
          .set(auth)
          .send({ courseName: "Camera Basics", completedAt: "2026-01-01T00:00:00.000Z" })
          .expect(201);
      }
      return res.body.id as string;
    }

    volunteerA = await makeVolunteer("analytics-a@example.com", "Alice", 3, true);
    volunteerB = await makeVolunteer("analytics-b@example.com", "Bob");
    volunteerC = await makeVolunteer("analytics-c@example.com", "Carol", 4, false);

    // A past service that only Alice is eligible/available for.
    const pastServiceRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services`)
      .set(auth)
      .send({ campusId, type: "SUNDAY_SERVICE", title: "Past Sunday", date: "2026-06-01T09:00:00.000Z", serviceStart: "2026-06-01T09:30:00.000Z" })
      .expect(201);
    const pastServiceId = pastServiceRes.body.id;
    const pastRoleRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${pastServiceId}/roles`)
      .set(auth)
      .send({ ministryId, name: "Camera 2", minRequired: 1, maxAllowed: 1 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${pastServiceId}/roles/${pastRoleRes.body.id}/skills`)
      .set(auth)
      .send({ skillName: "Camera Operation", minExperienceLevel: 2 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/volunteers/${volunteerA}/availability`)
      .set(auth)
      .send({ date: "2026-06-01", status: "AVAILABLE" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${pastServiceId}/schedule-runs`)
      .set(auth)
      .expect(201);

    // A future service requiring a skill nobody has — a guaranteed shortage.
    const futureServiceRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services`)
      .set(auth)
      .send({ campusId, type: "SUNDAY_SERVICE", title: "Future Sunday", date: "2026-07-19T09:00:00.000Z", serviceStart: "2026-07-19T09:30:00.000Z" })
      .expect(201);
    const futureRoleRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${futureServiceRes.body.id}/roles`)
      .set(auth)
      .send({ ministryId, name: "Lighting Designer", minRequired: 1, maxAllowed: 1 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${futureServiceRes.body.id}/roles/${futureRoleRes.body.id}/skills`)
      .set(auth)
      .send({ skillName: "Advanced Lighting", minExperienceLevel: 5 })
      .expect(201);
  }, 30000);

  it("who hasn't served recently — excludes the volunteer with a past assignment", async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/assistant/query`)
      .set(auth)
      .send({ question: "Who hasn't served recently?" })
      .expect(201);
    expect(res.body.matchedIntent).toBe("WHO_HASNT_SERVED");
    const ids = res.body.data.map((v: { volunteerProfileId: string }) => v.volunteerProfileId);
    expect(ids).toContain(volunteerB);
    expect(ids).toContain(volunteerC);
    expect(ids).not.toContain(volunteerA);
  });

  it("who can replace Alice — finds Carol (higher skill), not Bob (no skill)", async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/assistant/query`)
      .set(auth)
      .send({ question: "Who can replace Alice?" })
      .expect(201);
    expect(res.body.matchedIntent).toBe("WHO_CAN_REPLACE");
    const ids = res.body.data.replacements.map((v: { volunteerProfileId: string }) => v.volunteerProfileId);
    expect(ids).toContain(volunteerC);
    expect(ids).not.toContain(volunteerB);
  });

  it("which volunteers need training — excludes the trained volunteer", async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/assistant/query`)
      .set(auth)
      .send({ question: "Which volunteers need training?" })
      .expect(201);
    expect(res.body.matchedIntent).toBe("WHO_NEEDS_TRAINING");
    const ids = res.body.data.map((v: { volunteerProfileId: string }) => v.volunteerProfileId);
    expect(ids).toContain(volunteerB);
    expect(ids).toContain(volunteerC);
    expect(ids).not.toContain(volunteerA);
  });

  it("predicts a coverage shortage for the role nobody qualifies for", async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/assistant/query`)
      .set(auth)
      .send({ question: "Predict volunteer shortages for the next few weeks" })
      .expect(201);
    expect(res.body.matchedIntent).toBe("PREDICT_SHORTAGES");
    expect(res.body.data.some((g: { roleName: string }) => g.roleName === "Lighting Designer")).toBe(true);
  });

  it("gives a helpful fallback for an unrecognized question", async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/assistant/query`)
      .set(auth)
      .send({ question: "What's the weather like on Sunday?" })
      .expect(201);
    expect(res.body.matchedIntent).toBe("UNKNOWN");
    expect(res.body.answer).toContain("I can currently answer");
  });

  it("analytics: coverage trend reflects the completed past service at 100%", async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/churches/${churchId}/analytics/coverage?from=2026-01-01T00:00:00.000Z&to=2026-06-30T00:00:00.000Z`)
      .set(auth)
      .expect(200);
    expect(res.body.some((p: { title: string; coveragePct: number }) => p.title === "Past Sunday" && p.coveragePct === 100)).toBe(true);
  });

  it("analytics: reliability distribution and equipment usage return well-formed data", async () => {
    const reliabilityRes = await request(app.getHttpServer()).get(`/v1/churches/${churchId}/analytics/reliability`).set(auth).expect(200);
    expect(Array.isArray(reliabilityRes.body)).toBe(true);

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/equipment`)
      .set(auth)
      .send({ name: "Wireless Mic", category: "Audio" })
      .expect(201);
    const equipmentUsageRes = await request(app.getHttpServer()).get(`/v1/churches/${churchId}/analytics/equipment-usage`).set(auth).expect(200);
    expect(equipmentUsageRes.body.some((e: { category: string }) => e.category === "Audio")).toBe(true);
  });

  it("blocks cross-tenant access to analytics and the assistant", async () => {
    const churchB = await request(app.getHttpServer())
      .post("/v1/auth/register")
      .send({ email: "admin-b-analytics@example.com", password: "SuperSecret123", firstName: "Admin", lastName: "User", churchName: "Church B Analytics" })
      .expect(201);
    const churchBId = churchB.body.user.memberships[0].churchId;

    await request(app.getHttpServer())
      .get(`/v1/churches/${churchBId}/analytics/coverage`)
      .set(auth)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/churches/${churchBId}/assistant/query`)
      .set(auth)
      .send({ question: "Who hasn't served recently?" })
      .expect(403);
  });
});
