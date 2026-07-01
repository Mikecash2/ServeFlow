import { beforeAll, describe, expect, it } from "vitest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { HttpExceptionFilter } from "../../src/common/filters/http-exception.filter";
import { NotificationsRepository } from "../../src/modules/notifications/notifications.repository";
import { resetTestDatabase } from "./setup";

/**
 * Phase 8 exit criteria (docs/08-roadmap.md): a leader can announce to a
 * ministry channel and members receive an email — verified here by checking
 * a real Notification record was created for each ministry member (email
 * *sending* itself is stubbed without a Resend account, see
 * serveflow/README.md, but the notification pipeline and recipient
 * targeting are real). Also covers the Phase 4 confirm/decline endpoints
 * deferred to this phase.
 */
describe("Messaging integration", () => {
  let app: INestApplication;
  let notificationsRepo: NotificationsRepository;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
    process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";
    await resetTestDatabase();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix("v1", { exclude: ["health"] });
    await app.init();
    notificationsRepo = moduleRef.get(NotificationsRepository);
  }, 30000);

  async function registerChurch(churchName: string, email: string) {
    const res = await request(app.getHttpServer())
      .post("/v1/auth/register")
      .send({ email, password: "SuperSecret123", firstName: "Admin", lastName: "User", churchName })
      .expect(201);
    return res.body as { user: { memberships: Array<{ churchId: string }> }; accessToken: string };
  }

  it("announcing to a ministry channel creates an email notification for each member", async () => {
    const session = await registerChurch("Kharis Bristol Messaging", "admin-msg@example.com");
    const churchId = session.user.memberships[0].churchId;
    const auth = { Authorization: `Bearer ${session.accessToken}` };

    const ministryRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/ministries`)
      .set(auth)
      .send({ name: "Production", category: "PRODUCTION" })
      .expect(201);
    const ministryId = ministryRes.body.id;

    const volunteerRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/volunteers`)
      .set(auth)
      .send({ email: "dave-msg@example.com", firstName: "Dave", lastName: "Operator" })
      .expect(201);
    const volunteerUserId = volunteerRes.body.userId;

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/ministries/${ministryId}/volunteers/${volunteerRes.body.id}`)
      .set(auth)
      .expect(201);

    const channelRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/channels`)
      .set(auth)
      .send({ type: "ANNOUNCEMENT", ministryId, name: "Production Announcements" })
      .expect(201);
    const channelId = channelRes.body.id;

    const listChannelsRes = await request(app.getHttpServer()).get(`/v1/churches/${churchId}/channels`).set(auth).expect(200);
    expect(listChannelsRes.body.some((c: { id: string }) => c.id === channelId)).toBe(true);

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/channels/${channelId}/messages`)
      .set(auth)
      .send({ body: "Sunday call time moved to 7am, please confirm." })
      .expect(201);

    const messagesRes = await request(app.getHttpServer())
      .get(`/v1/churches/${churchId}/channels/${channelId}/messages`)
      .set(auth)
      .expect(200);
    expect(messagesRes.body).toHaveLength(1);
    expect(messagesRes.body[0].body).toContain("7am");

    const notifications = await notificationsRepo.listForUser(churchId, volunteerUserId);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].channel).toBe("EMAIL");
    expect(notifications[0].title).toContain("Production Announcements");
  });

  it("supports confirming an assignment and declining triggers a bounded re-solve", async () => {
    const session = await registerChurch("Kharis Bristol Confirm", "admin-confirm@example.com");
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

    const serviceRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services`)
      .set(auth)
      .send({ campusId, type: "SUNDAY_SERVICE", title: "Sunday Service", date: "2026-07-12T09:00:00.000Z", serviceStart: "2026-07-12T09:30:00.000Z" })
      .expect(201);
    const serviceId = serviceRes.body.id;

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/roles`)
      .set(auth)
      .send({ ministryId, name: "Camera 2", minRequired: 1, maxAllowed: 1 })
      .expect(201);

    // Two eligible volunteers so a decline has someone to fall back to.
    const volunteerIds: string[] = [];
    for (const email of ["first@example.com", "second@example.com"]) {
      const res = await request(app.getHttpServer())
        .post(`/v1/churches/${churchId}/volunteers`)
        .set(auth)
        .send({ email, firstName: "Vol", lastName: email })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/v1/churches/${churchId}/ministries/${ministryId}/volunteers/${res.body.id}`)
        .set(auth)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/v1/churches/${churchId}/volunteers/${res.body.id}/availability`)
        .set(auth)
        .send({ date: "2026-07-12", status: "AVAILABLE" })
        .expect(201);
      volunteerIds.push(res.body.id);
    }

    const generateRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/schedule-runs`)
      .set(auth)
      .expect(201);
    const assignment = generateRes.body.assignments[0];
    expect(assignment).toBeDefined();

    const confirmRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/assignments/${assignment.id}/confirm`)
      .set(auth)
      .expect(201);
    expect(confirmRes.body.confirmedAt).not.toBeNull();

    // A second schedule for a decline test (fresh assignment, unconfirmed).
    const serviceRes2 = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services`)
      .set(auth)
      .send({ campusId, type: "SUNDAY_SERVICE", title: "Sunday Service 2", date: "2026-07-19T09:00:00.000Z", serviceStart: "2026-07-19T09:30:00.000Z" })
      .expect(201);
    const serviceId2 = serviceRes2.body.id;
    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId2}/roles`)
      .set(auth)
      .send({ ministryId, name: "Camera 2", minRequired: 1, maxAllowed: 1 })
      .expect(201);
    for (const volunteerId of volunteerIds) {
      await request(app.getHttpServer())
        .post(`/v1/churches/${churchId}/volunteers/${volunteerId}/availability`)
        .set(auth)
        .send({ date: "2026-07-19", status: "AVAILABLE" })
        .expect(201);
    }
    const generateRes2 = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId2}/schedule-runs`)
      .set(auth)
      .expect(201);
    const assignment2 = generateRes2.body.assignments[0];

    const declineRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/assignments/${assignment2.id}/decline`)
      .set(auth)
      .expect(201);
    expect(declineRes.body.declined).toBe(true);
    expect(declineRes.body.replacement).toBeDefined();
    expect(declineRes.body.replacement.volunteerProfileId).not.toBe(assignment2.volunteerProfileId);
    expect(volunteerIds).toContain(declineRes.body.replacement.volunteerProfileId);
  });

  it("blocks cross-tenant access to channels", async () => {
    const churchA = await registerChurch("Church A Messaging", "admin-a-msg@example.com");
    const churchB = await registerChurch("Church B Messaging", "admin-b-msg@example.com");
    const churchBId = churchB.user.memberships[0].churchId;

    await request(app.getHttpServer())
      .get(`/v1/churches/${churchBId}/channels`)
      .set("Authorization", `Bearer ${churchA.accessToken}`)
      .expect(403);
  });
});
