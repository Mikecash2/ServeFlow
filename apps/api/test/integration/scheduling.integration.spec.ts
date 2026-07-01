import { beforeAll, describe, expect, it } from "vitest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { HttpExceptionFilter } from "../../src/common/filters/http-exception.filter";
import { resetTestDatabase } from "./setup";

/**
 * Phase 4 exit criteria (docs/08-roadmap.md): "Generate Schedule" produces a
 * real roster for a seeded test church with correct explainability output,
 * verified by assertions on specific expected assignments given known
 * inputs — not just that the endpoint returns 200.
 */
describe("AI Scheduling integration", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
    process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";
    await resetTestDatabase();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix("v1", { exclude: ["health"] });
    await app.init();
  }, 30000);

  async function registerChurch(churchName: string, email: string) {
    const res = await request(app.getHttpServer())
      .post("/v1/auth/register")
      .send({ email, password: "SuperSecret123", firstName: "Admin", lastName: "User", churchName })
      .expect(201);
    return res.body as { user: { memberships: Array<{ churchId: string }> }; accessToken: string };
  }

  async function setUpChurchWithRole(churchName: string, email: string) {
    const session = await registerChurch(churchName, email);
    const churchId = session.user.memberships[0].churchId;
    const auth = { Authorization: `Bearer ${session.accessToken}` };

    const campusesRes = await request(app.getHttpServer()).get(`/v1/churches/${churchId}/campuses`).set(auth).expect(200);
    const campusId = campusesRes.body[0].id;

    const ministryRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/ministries`)
      .set(auth)
      .send({ name: "Production", category: "PRODUCTION" })
      .expect(201);
    const ministryId = ministryRes.body.id;

    const serviceDate = "2026-07-12T09:00:00.000Z";
    const serviceRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services`)
      .set(auth)
      .send({ campusId, type: "SUNDAY_SERVICE", title: "Sunday Service", date: serviceDate, serviceStart: "2026-07-12T09:30:00.000Z" })
      .expect(201);
    const serviceId = serviceRes.body.id;

    const roleRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/roles`)
      .set(auth)
      .send({ ministryId, name: "Camera 2", minRequired: 1, maxAllowed: 1 })
      .expect(201);
    const roleId = roleRes.body.id;

    return { churchId, auth, ministryId, serviceId, roleId };
  }

  async function inviteAndAssignToMinistry(churchId: string, auth: Record<string, string>, ministryId: string, email: string) {
    const res = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/volunteers`)
      .set(auth)
      .send({ email, firstName: "Vol", lastName: email.split("@")[0] })
      .expect(201);
    const volunteerId = res.body.id;

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/ministries/${ministryId}/volunteers/${volunteerId}`)
      .set(auth)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/volunteers/${volunteerId}/availability`)
      .set(auth)
      .send({ date: "2026-07-12", status: "AVAILABLE" })
      .expect(201);

    return volunteerId;
  }

  it("generates a schedule respecting skill requirements, explains the assignment, and supports override", async () => {
    const { churchId, auth, roleId, serviceId } = await setUpChurchWithRole("Kharis Bristol Scheduling", "admin-sched@example.com");

    const qualifiedId = await inviteAndAssignToMinistry(churchId, auth, (await request(app.getHttpServer())
      .get(`/v1/churches/${churchId}/ministries`).set(auth)).body[0].id, "qualified@example.com");
    const unqualifiedId = await inviteAndAssignToMinistry(churchId, auth, (await request(app.getHttpServer())
      .get(`/v1/churches/${churchId}/ministries`).set(auth)).body[0].id, "unqualified@example.com");

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/roles/${roleId}/skills`)
      .set(auth)
      .send({ skillName: "Camera Operation", minExperienceLevel: 2 })
      .expect(201);

    // Only the qualified volunteer meets the required skill level.
    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/volunteers/${qualifiedId}/skills`)
      .set(auth)
      .send({ skillName: "Camera Operation", experienceLevel: 3 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/volunteers/${qualifiedId}/preferred-roles`)
      .set(auth)
      .send({ roleName: "Camera 2" })
      .expect(201);

    const generateRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/schedule-runs`)
      .set(auth)
      .expect(201);
    expect(generateRes.body.coveragePct).toBe(100);
    expect(generateRes.body.assignments).toHaveLength(1);
    const assignment = generateRes.body.assignments[0];
    expect(assignment.volunteerProfileId).toBe(qualifiedId);
    expect(assignment.volunteerProfileId).not.toBe(unqualifiedId);
    expect(assignment.reasoning.hardConstraintsPassed).toContain("required_skills");

    const explainRes = await request(app.getHttpServer())
      .get(`/v1/churches/${churchId}/assignments/${assignment.id}/explain`)
      .set(auth)
      .expect(200);
    expect(explainRes.body.explanation).toContain("Vol");
    expect(typeof explainRes.body.explanation).toBe("string");

    const overrideRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/assignments/${assignment.id}/override`)
      .set(auth)
      .send({ volunteerProfileId: unqualifiedId })
      .expect(201);
    expect(overrideRes.body.volunteerProfileId).toBe(unqualifiedId);
    expect(overrideRes.body.source).toBe("MANUAL_OVERRIDE");
  });

  it("reports a coverage gap when no eligible candidate exists for a role", async () => {
    const { churchId, auth, serviceId } = await setUpChurchWithRole("Kharis Bristol Gaps", "admin-gap@example.com");
    // No volunteers invited/assigned/available at all — the role should go unfilled.

    const generateRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/schedule-runs`)
      .set(auth)
      .expect(201);
    expect(generateRes.body.coveragePct).toBe(0);
    expect(generateRes.body.assignments).toHaveLength(0);
    expect(generateRes.body.summary).toContain("Camera 2");
  });

  it("blocks cross-tenant access to schedule runs", async () => {
    const { churchId: churchAId, auth: authA } = await setUpChurchWithRole("Church A Scheduling", "admin-a-sched@example.com");
    const churchB = await registerChurch("Church B Scheduling", "admin-b-sched@example.com");
    const churchBId = churchB.user.memberships[0].churchId;

    await request(app.getHttpServer())
      .get(`/v1/churches/${churchBId}/services`)
      .set(authA)
      .expect(403);
    void churchAId;
  });
});
