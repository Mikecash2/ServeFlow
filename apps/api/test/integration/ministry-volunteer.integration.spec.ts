import { beforeAll, describe, expect, it } from "vitest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { HttpExceptionFilter } from "../../src/common/filters/http-exception.filter";
import { resetTestDatabase } from "./setup";

/**
 * Phase 2 exit criteria (docs/08-roadmap.md): a leader can build a roster of
 * volunteers with skills and see their availability for an upcoming date,
 * within a Ministry/Team structure — and RBAC/tenant isolation still holds
 * for all of the new resources.
 */
describe("Ministry & Volunteer Management integration", () => {
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
      .send({
        email,
        password: "SuperSecret123",
        firstName: "Admin",
        lastName: "User",
        churchName,
      })
      .expect(201);
    return res.body as { user: { memberships: Array<{ churchId: string }> }; accessToken: string };
  }

  it("lets a Church Admin build Kharis Bristol's Production Team and roster a volunteer with skills", async () => {
    const session = await registerChurch("Kharis Bristol", "admin-kharis@example.com");
    const churchId = session.user.memberships[0].churchId;
    const auth = { Authorization: `Bearer ${session.accessToken}` };

    const ministryRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/ministries`)
      .set(auth)
      .send({ name: "Production", category: "PRODUCTION", description: "Sound, lighting, streaming." })
      .expect(201);
    const ministryId = ministryRes.body.id;
    expect(ministryRes.body.category).toBe("PRODUCTION");

    const teamRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/ministries/${ministryId}/teams`)
      .set(auth)
      .send({ name: "Production Team" })
      .expect(201);
    expect(teamRes.body.name).toBe("Production Team");

    const teamsListRes = await request(app.getHttpServer())
      .get(`/v1/churches/${churchId}/ministries/${ministryId}/teams`)
      .set(auth)
      .expect(200);
    expect(teamsListRes.body).toHaveLength(1);

    const volunteerRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/volunteers`)
      .set(auth)
      .send({ email: "dave@example.com", firstName: "Dave", lastName: "Operator" })
      .expect(201);
    const volunteerId = volunteerRes.body.id;
    expect(volunteerRes.body.status).toBe("ACTIVE");

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/volunteers/${volunteerId}/skills`)
      .set(auth)
      .send({ skillName: "Camera Operation", experienceLevel: 3, yearsExperience: 2 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/volunteers/${volunteerId}/certifications`)
      .set(auth)
      .send({ name: "First Aid" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/volunteers/${volunteerId}/training`)
      .set(auth)
      .send({ courseName: "Streaming Basics", requiredForRoles: ["Streaming Operator"] })
      .expect(201);

    const detailRes = await request(app.getHttpServer())
      .get(`/v1/churches/${churchId}/volunteers/${volunteerId}`)
      .set(auth)
      .expect(200);
    expect(detailRes.body.skills).toHaveLength(1);
    expect(detailRes.body.skills[0].skillName).toBe("Camera Operation");
    expect(detailRes.body.certifications).toHaveLength(1);
    expect(detailRes.body.trainingRecords).toHaveLength(1);

    await request(app.getHttpServer())
      .patch(`/v1/churches/${churchId}/volunteers/${volunteerId}/status`)
      .set(auth)
      .send({ status: "SUSPENDED" })
      .expect(200)
      .then((res) => expect(res.body.status).toBe("SUSPENDED"));

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/volunteers/${volunteerId}/availability`)
      .set(auth)
      .send({ date: "2026-07-12", status: "AVAILABLE" })
      .expect(201);

    const availabilityListRes = await request(app.getHttpServer())
      .get(`/v1/churches/${churchId}/volunteers/${volunteerId}/availability?from=2026-07-01&to=2026-07-31`)
      .set(auth)
      .expect(200);
    expect(availabilityListRes.body).toHaveLength(1);
    expect(availabilityListRes.body[0].status).toBe("AVAILABLE");
  });

  it("blocks cross-tenant access to ministries and volunteers", async () => {
    const churchA = await registerChurch("Church A2", "admin-a2@example.com");
    const churchB = await registerChurch("Church B2", "admin-b2@example.com");
    const churchBId = churchB.user.memberships[0].churchId;

    await request(app.getHttpServer())
      .get(`/v1/churches/${churchBId}/ministries`)
      .set("Authorization", `Bearer ${churchA.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/v1/churches/${churchBId}/volunteers`)
      .set("Authorization", `Bearer ${churchA.accessToken}`)
      .expect(403);
  });

  it("returns 404 for a ministry that does not belong to the given church", async () => {
    const churchA = await registerChurch("Church A3", "admin-a3@example.com");
    const churchAId = churchA.user.memberships[0].churchId;
    const authA = { Authorization: `Bearer ${churchA.accessToken}` };

    await request(app.getHttpServer())
      .get(`/v1/churches/${churchAId}/ministries/does-not-exist`)
      .set(authA)
      .expect(404);
  });
});
