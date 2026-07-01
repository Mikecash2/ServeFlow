import { beforeAll, describe, expect, it } from "vitest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { HttpExceptionFilter } from "../../src/common/filters/http-exception.filter";
import { resetTestDatabase } from "./setup";

/**
 * Phase 3 exit criteria (docs/08-roadmap.md): a full Sunday service can be
 * created end-to-end with setup/service/de-rig tasks and a checklist
 * attached — verified here against Kharis Bristol's Production ministry.
 */
describe("Services & Tasks integration", () => {
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

  it("builds a full Sunday service with roles, phased tasks, and a completed checklist item", async () => {
    const session = await registerChurch("Kharis Bristol Services", "admin-services@example.com");
    const churchId = session.user.memberships[0].churchId;
    const auth = { Authorization: `Bearer ${session.accessToken}` };

    const campusesRes = await request(app.getHttpServer())
      .get(`/v1/churches/${churchId}/campuses`)
      .set(auth)
      .expect(200);
    const campusId = campusesRes.body[0].id;

    const ministryRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/ministries`)
      .set(auth)
      .send({ name: "Production", category: "PRODUCTION" })
      .expect(201);
    const ministryId = ministryRes.body.id;

    const serviceRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services`)
      .set(auth)
      .send({
        campusId,
        type: "SUNDAY_SERVICE",
        title: "Sunday Service",
        date: "2026-07-12T09:00:00.000Z",
        setupStart: "2026-07-12T07:00:00.000Z",
        serviceStart: "2026-07-12T09:30:00.000Z",
        serviceEnd: "2026-07-12T11:00:00.000Z",
        derigEnd: "2026-07-12T12:00:00.000Z",
      })
      .expect(201);
    const serviceId = serviceRes.body.id;
    expect(serviceRes.body.type).toBe("SUNDAY_SERVICE");

    const roleRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/roles`)
      .set(auth)
      .send({ ministryId, name: "Camera 2", minRequired: 1, maxAllowed: 1 })
      .expect(201);
    const roleId = roleRes.body.id;

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/roles/${roleId}/skills`)
      .set(auth)
      .send({ skillName: "Camera Operation", minExperienceLevel: 2 })
      .expect(201);

    const setupTaskRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/tasks`)
      .set(auth)
      .send({ phase: "SETUP", title: "Power on rig", priority: 1 })
      .expect(201);
    const setupTaskId = setupTaskRes.body.id;

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/tasks`)
      .set(auth)
      .send({ phase: "SETUP", title: "Soundcheck", priority: 2, dependsOnTaskId: setupTaskId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/tasks`)
      .set(auth)
      .send({ phase: "DERIG", title: "Cable teardown" })
      .expect(201);

    const setupTasksRes = await request(app.getHttpServer())
      .get(`/v1/churches/${churchId}/services/${serviceId}/tasks?phase=SETUP`)
      .set(auth)
      .expect(200);
    expect(setupTasksRes.body).toHaveLength(2);

    const startedRes = await request(app.getHttpServer())
      .patch(`/v1/churches/${churchId}/services/${serviceId}/tasks/${setupTaskId}`)
      .set(auth)
      .send({ status: "IN_PROGRESS" })
      .expect(200);
    expect(startedRes.body.startedAt).not.toBeNull();

    const completedRes = await request(app.getHttpServer())
      .patch(`/v1/churches/${churchId}/services/${serviceId}/tasks/${setupTaskId}`)
      .set(auth)
      .send({ status: "COMPLETED" })
      .expect(200);
    expect(completedRes.body.completedAt).not.toBeNull();

    const templateRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/checklist-templates`)
      .set(auth)
      .send({ kind: "SETUP", name: "Stage Setup" })
      .expect(201);
    const templateId = templateRes.body.id;

    const itemRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/checklist-templates/${templateId}/items`)
      .set(auth)
      .send({ label: "Mics on stands", sortOrder: 1 })
      .expect(201);
    const itemId = itemRes.body.id;

    const instanceRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/checklist-instances`)
      .set(auth)
      .send({ templateId })
      .expect(201);
    const instanceId = instanceRes.body.id;

    const completeRes = await request(app.getHttpServer())
      .patch(`/v1/churches/${churchId}/services/${serviceId}/checklist-instances/${instanceId}/items/${itemId}`)
      .set(auth)
      .send({ note: "Checked twice" })
      .expect(200);
    expect(completeRes.body.completedItems[itemId]).toBeDefined();
    expect(completeRes.body.completedItems[itemId].note).toBe("Checked twice");
  });

  it("blocks cross-tenant access to a service and 404s an unknown service in-tenant", async () => {
    const churchA = await registerChurch("Church A Services", "admin-a-services@example.com");
    const churchB = await registerChurch("Church B Services", "admin-b-services@example.com");
    const churchBId = churchB.user.memberships[0].churchId;
    const churchAId = churchA.user.memberships[0].churchId;

    await request(app.getHttpServer())
      .get(`/v1/churches/${churchBId}/services`)
      .set("Authorization", `Bearer ${churchA.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/v1/churches/${churchAId}/services/does-not-exist`)
      .set("Authorization", `Bearer ${churchA.accessToken}`)
      .expect(404);
  });
});
