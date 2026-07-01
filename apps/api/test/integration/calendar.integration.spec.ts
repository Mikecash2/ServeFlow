import { beforeAll, describe, expect, it } from "vitest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { HttpExceptionFilter } from "../../src/common/filters/http-exception.filter";
import { resetTestDatabase } from "./setup";

/**
 * Phase 10 exit criteria (docs/08-roadmap.md): the ICS feed is well-formed,
 * and the RRULE expansion deferred since Phase 2/3 actually produces
 * correct dates for both recurring availability and recurring services.
 */
describe("Calendar integration", () => {
  let app: INestApplication;
  let churchId: string;
  let auth: { Authorization: string };
  let campusId: string;

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
      .send({ email: "admin-calendar@example.com", password: "SuperSecret123", firstName: "Admin", lastName: "User", churchName: "Kharis Bristol Calendar" })
      .expect(201);
    churchId = registerRes.body.user.memberships[0].churchId;
    auth = { Authorization: `Bearer ${registerRes.body.accessToken}` };

    const campusesRes = await request(app.getHttpServer()).get(`/v1/churches/${churchId}/campuses`).set(auth).expect(200);
    campusId = campusesRes.body[0].id;
  }, 30000);

  it("exports a well-formed ICS feed containing a created service", async () => {
    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services`)
      .set(auth)
      .send({ campusId, type: "SUNDAY_SERVICE", title: "ICS Test Service", date: "2026-07-12T09:00:00.000Z", serviceStart: "2026-07-12T09:30:00.000Z" })
      .expect(201);

    const res = await request(app.getHttpServer()).get(`/v1/churches/${churchId}/calendar.ics`).set(auth).expect(200);
    expect(res.headers["content-type"]).toContain("text/calendar");
    expect(res.text).toContain("BEGIN:VCALENDAR");
    expect(res.text).toContain("BEGIN:VEVENT");
    expect(res.text).toContain("ICS Test Service");
    expect(res.text).toContain("END:VCALENDAR");
  });

  it("expands recurring availability into individual weekly rows", async () => {
    const volunteerRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/volunteers`)
      .set(auth)
      .send({ email: "recurring-vol@example.com", firstName: "Rae", lastName: "Curring" })
      .expect(201);
    const volunteerId = volunteerRes.body.id;

    const res = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/volunteers/${volunteerId}/availability/recurring`)
      .set(auth)
      .send({ recurrenceRule: "FREQ=WEEKLY", status: "UNAVAILABLE", from: "2026-08-01", to: "2026-08-29" })
      .expect(201);
    expect(res.body).toHaveLength(5); // Aug 1, 8, 15, 22, 29

    const listRes = await request(app.getHttpServer())
      .get(`/v1/churches/${churchId}/volunteers/${volunteerId}/availability?from=2026-08-01&to=2026-08-29`)
      .set(auth)
      .expect(200);
    expect(listRes.body).toHaveLength(5);
    expect(listRes.body.every((a: { status: string }) => a.status === "UNAVAILABLE")).toBe(true);
  });

  it("generates real recurring service occurrences shifted by the correct interval", async () => {
    const serviceRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services`)
      .set(auth)
      .send({
        campusId,
        type: "SUNDAY_SERVICE",
        title: "Weekly Sunday",
        date: "2026-09-06T09:00:00.000Z",
        serviceStart: "2026-09-06T09:30:00.000Z",
        recurrenceRule: "FREQ=WEEKLY",
      })
      .expect(201);
    const serviceId = serviceRes.body.id;

    const generatedRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/generate-recurring`)
      .set(auth)
      .send({ count: 3 })
      .expect(201);
    expect(generatedRes.body).toHaveLength(3);
    expect(generatedRes.body[0].title).toBe("Weekly Sunday");
    expect(new Date(generatedRes.body[0].serviceStart).toISOString()).toBe("2026-09-13T09:30:00.000Z");
    expect(new Date(generatedRes.body[1].serviceStart).toISOString()).toBe("2026-09-20T09:30:00.000Z");
    expect(new Date(generatedRes.body[2].serviceStart).toISOString()).toBe("2026-09-27T09:30:00.000Z");

    const allServicesRes = await request(app.getHttpServer())
      .get(`/v1/churches/${churchId}/services?from=2026-09-01T00:00:00.000Z&to=2026-10-05T00:00:00.000Z`)
      .set(auth)
      .expect(200);
    expect(allServicesRes.body).toHaveLength(4); // original + 3 generated
  });

  it("rejects generate-recurring for a service with no recurrenceRule", async () => {
    const serviceRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services`)
      .set(auth)
      .send({ campusId, type: "SUNDAY_SERVICE", title: "One-off", date: "2026-10-11T09:00:00.000Z", serviceStart: "2026-10-11T09:30:00.000Z" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceRes.body.id}/generate-recurring`)
      .set(auth)
      .send({ count: 2 })
      .expect(400);
  });

  it("blocks cross-tenant access to the calendar feed", async () => {
    const churchB = await request(app.getHttpServer())
      .post("/v1/auth/register")
      .send({ email: "admin-b-calendar@example.com", password: "SuperSecret123", firstName: "Admin", lastName: "User", churchName: "Church B Calendar" })
      .expect(201);
    const churchBId = churchB.body.user.memberships[0].churchId;

    await request(app.getHttpServer())
      .get(`/v1/churches/${churchBId}/calendar.ics`)
      .set(auth)
      .expect(403);
  });
});
