import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { io, Socket } from "socket.io-client";
import { AppModule } from "../../src/app.module";
import { HttpExceptionFilter } from "../../src/common/filters/http-exception.filter";
import { resetTestDatabase } from "./setup";

/**
 * Phase 7 exit criteria (docs/08-roadmap.md): check-in works (QR/manual/GPS
 * payload), late arrivals are flagged, the roster reflects real state, a
 * live checkin.recorded event fires, and the reliability recompute endpoint
 * actually persists a new score onto the volunteer profile.
 */
describe("Attendance & Check-in integration", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
    process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";
    await resetTestDatabase();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix("v1", { exclude: ["health"] });
    await app.listen(0);
    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  function connectClient(token: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = io(`${baseUrl}/realtime`, { auth: { token }, transports: ["websocket"], forceNew: true });
      socket.on("connect", () => resolve(socket));
      socket.on("connect_error", (err) => reject(err));
    });
  }

  async function setUpChurchWithAssignedVolunteer(churchName: string, email: string, serviceStart: string) {
    const registerRes = await request(app.getHttpServer())
      .post("/v1/auth/register")
      .send({ email, password: "SuperSecret123", firstName: "Admin", lastName: "User", churchName })
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

    const serviceRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services`)
      .set(auth)
      .send({ campusId, type: "SUNDAY_SERVICE", title: "Sunday Service", date: serviceStart, serviceStart })
      .expect(201);
    const serviceId = serviceRes.body.id;

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/roles`)
      .set(auth)
      .send({ ministryId, name: "Camera 2", minRequired: 1, maxAllowed: 1 })
      .expect(201);

    const volunteerRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/volunteers`)
      .set(auth)
      .send({ email: `vol-${email}`, firstName: "Dave", lastName: "Operator" })
      .expect(201);
    const volunteerId = volunteerRes.body.id;

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/ministries/${ministryId}/volunteers/${volunteerId}`)
      .set(auth)
      .expect(201);

    const dateOnly = serviceStart.slice(0, 10);
    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/volunteers/${volunteerId}/availability`)
      .set(auth)
      .send({ date: dateOnly, status: "AVAILABLE" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/schedule-runs`)
      .set(auth)
      .expect(201);

    return { churchId, auth, serviceId, volunteerId, accessToken: registerRes.body.accessToken as string };
  }

  it("records an on-time check-in, updates the roster live, and appears in the roster", async () => {
    const { churchId, auth, serviceId, volunteerId, accessToken } = await setUpChurchWithAssignedVolunteer(
      "Kharis Bristol Attendance",
      "admin-attend@example.com",
      "2030-01-01T09:00:00.000Z", // far future — checking in "now" is on time
    );

    const client = await connectClient(accessToken);
    await new Promise((resolve) => client.emit("join", { churchId }, resolve));
    const checkinEventPromise = new Promise<any>((resolve) => client.once("checkin.recorded", resolve));

    const checkinRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/attendance/checkin`)
      .set(auth)
      .send({ volunteerProfileId: volunteerId, method: "QR_CODE" })
      .expect(201);
    expect(checkinRes.body.isLate).toBe(false);

    const event = await checkinEventPromise;
    expect(event.volunteerProfileId).toBe(volunteerId);
    expect(event.isLate).toBe(false);

    const rosterRes = await request(app.getHttpServer())
      .get(`/v1/churches/${churchId}/services/${serviceId}/attendance`)
      .set(auth)
      .expect(200);
    expect(rosterRes.body).toHaveLength(1);
    expect(rosterRes.body[0].volunteerProfileId).toBe(volunteerId);
    expect(rosterRes.body[0].checkedInAt).not.toBeNull();
    expect(rosterRes.body[0].roleName).toBe("Camera 2");

    client.disconnect();
  }, 15000);

  it("flags a late check-in and persists a recomputed reliability score", async () => {
    const { churchId, auth, serviceId, volunteerId } = await setUpChurchWithAssignedVolunteer(
      "Kharis Bristol Late",
      "admin-late@example.com",
      "2020-01-01T09:00:00.000Z", // far past — checking in "now" is late
    );

    const checkinRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/services/${serviceId}/attendance/checkin`)
      .set(auth)
      .send({ volunteerProfileId: volunteerId, method: "MANUAL" })
      .expect(201);
    expect(checkinRes.body.isLate).toBe(true);

    const recomputeRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/reliability/recompute`)
      .set(auth)
      .expect(201);
    expect(recomputeRes.body.updated).toBeGreaterThanOrEqual(1);

    const volunteerRes = await request(app.getHttpServer())
      .get(`/v1/churches/${churchId}/volunteers/${volunteerId}`)
      .set(auth)
      .expect(200);
    // Only 1 data point so far (< 5) — expect the Bayesian-prior default.
    expect(volunteerRes.body.reliabilityScore).toBeCloseTo(0.85, 5);
  });

  it("blocks cross-tenant access to attendance", async () => {
    const churchA = await request(app.getHttpServer())
      .post("/v1/auth/register")
      .send({ email: "admin-a-attend@example.com", password: "SuperSecret123", firstName: "Admin", lastName: "User", churchName: "Church A Attendance" })
      .expect(201);
    const churchB = await request(app.getHttpServer())
      .post("/v1/auth/register")
      .send({ email: "admin-b-attend@example.com", password: "SuperSecret123", firstName: "Admin", lastName: "User", churchName: "Church B Attendance" })
      .expect(201);
    const churchBId = churchB.body.user.memberships[0].churchId;

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchBId}/reliability/recompute`)
      .set("Authorization", `Bearer ${churchA.body.accessToken}`)
      .expect(403);
  });
});
