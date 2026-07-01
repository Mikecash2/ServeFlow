import { beforeAll, describe, expect, it } from "vitest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { HttpExceptionFilter } from "../../src/common/filters/http-exception.filter";
import { resetTestDatabase } from "./setup";

/**
 * Phase 5 exit criteria (docs/08-roadmap.md): the dashboard mockup becomes a
 * real, data-driven page. This proves the aggregation endpoint reflects
 * actual state — before and after a schedule is generated — rather than
 * just asserting it returns 200.
 */
describe("Dashboard aggregation integration", () => {
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

  it("reflects a coverage gap before scheduling and full coverage after", async () => {
    const registerRes = await request(app.getHttpServer())
      .post("/v1/auth/register")
      .send({
        email: "admin-dash@example.com",
        password: "SuperSecret123",
        firstName: "Admin",
        lastName: "User",
        churchName: "Kharis Bristol Dashboard",
      })
      .expect(201);
    const churchId = registerRes.body.user.memberships[0].churchId;
    const auth = { Authorization: `Bearer ${registerRes.body.accessToken}` };

    const campusesRes = await request(app.getHttpServer()).get(`/v1/churches/${churchId}/campuses`).set(auth).expect(200);
    const campusId = campusesRes.body[0].id;

    const ministryRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/ministries`)
      .set(auth)
      .send({ name: "Production", category: "PRODUCTION" })
      .expect(201);
    const ministryId = ministryRes.body.id;

    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days out
    const serviceRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services`)
      .set(auth)
      .send({ campusId, type: "SUNDAY_SERVICE", title: "Sunday Service", date: soon.toISOString(), serviceStart: soon.toISOString() })
      .expect(201);
    const serviceId = serviceRes.body.id;

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/roles`)
      .set(auth)
      .send({ ministryId, name: "Camera 2", minRequired: 1, maxAllowed: 1 })
      .expect(201);

    // Before scheduling: no run yet, coverage gap should surface.
    const beforeRes = await request(app.getHttpServer()).get(`/v1/churches/${churchId}/dashboard`).set(auth).expect(200);
    expect(beforeRes.body.focusService.id).toBe(serviceId);
    expect(beforeRes.body.focusService.coveragePct).toBeNull();
    expect(beforeRes.body.recommendations.some((r: string) => r.includes("No schedule has been generated"))).toBe(true);

    const volunteerRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/volunteers`)
      .set(auth)
      .send({ email: "dave@example.com", firstName: "Dave", lastName: "Operator" })
      .expect(201);
    const volunteerId = volunteerRes.body.id;

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/ministries/${ministryId}/volunteers/${volunteerId}`)
      .set(auth)
      .expect(201);

    const dateOnly = soon.toISOString().slice(0, 10);
    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/volunteers/${volunteerId}/availability`)
      .set(auth)
      .send({ date: dateOnly, status: "AVAILABLE" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/schedule-runs`)
      .set(auth)
      .expect(201);

    const afterRes = await request(app.getHttpServer()).get(`/v1/churches/${churchId}/dashboard`).set(auth).expect(200);
    expect(afterRes.body.focusService.coveragePct).toBe(100);
    expect(afterRes.body.focusService.missingRoles).toHaveLength(0);
    expect(afterRes.body.availabilityPct).toBe(100);
    expect(afterRes.body.recommendations.some((r: string) => r.includes("Coverage gap"))).toBe(false);
  });
});
