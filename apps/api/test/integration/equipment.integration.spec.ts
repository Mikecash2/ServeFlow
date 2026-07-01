import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { io, Socket } from "socket.io-client";
import { AppModule } from "../../src/app.module";
import { HttpExceptionFilter } from "../../src/common/filters/http-exception.filter";
import { resetTestDatabase } from "./setup";

/**
 * Phase 6 exit criteria (docs/08-roadmap.md): equipment can be reserved for
 * a service, and a fault report triggers a real-time alert to the relevant
 * leader — proven with a genuine socket.io-client connection, not just a
 * 201 response from the report endpoint.
 */
describe("Equipment Management integration", () => {
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

  async function registerChurch(churchName: string, email: string) {
    const res = await request(app.getHttpServer())
      .post("/v1/auth/register")
      .send({ email, password: "SuperSecret123", firstName: "Admin", lastName: "User", churchName })
      .expect(201);
    return res.body as { user: { memberships: Array<{ churchId: string }> }; accessToken: string };
  }

  it("supports inventory, QR codes, checkout/checkin, maintenance, and a live fault alert", async () => {
    const session = await registerChurch("Kharis Bristol Equipment", "admin-equip@example.com");
    const churchId = session.user.memberships[0].churchId;
    const auth = { Authorization: `Bearer ${session.accessToken}` };

    const equipmentRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/equipment`)
      .set(auth)
      .send({ name: "Wireless Mic 3", category: "Audio", storageLocation: "Cabinet A" })
      .expect(201);
    const equipmentId = equipmentRes.body.id;
    expect(equipmentRes.body.qrCode).toMatch(/^SF-/);
    expect(equipmentRes.body.status).toBe("AVAILABLE");

    const qrRes = await request(app.getHttpServer()).get(`/v1/churches/${churchId}/equipment/${equipmentId}/qrcode`).set(auth).expect(200);
    expect(qrRes.body.qrImageDataUrl).toMatch(/^data:image\/png;base64,/);

    const reservationRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/equipment/${equipmentId}/reservations`)
      .set(auth)
      .send({ reservedFrom: "2026-07-12T07:00:00.000Z", reservedTo: "2026-07-12T12:00:00.000Z" })
      .expect(201);
    const reservationId = reservationRes.body.id;

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/equipment/${equipmentId}/reservations/${reservationId}/checkout`)
      .set(auth)
      .expect(201)
      .then((res) => expect(res.body.checkedOutAt).not.toBeNull());

    const afterCheckoutRes = await request(app.getHttpServer()).get(`/v1/churches/${churchId}/equipment/${equipmentId}`).set(auth).expect(200);
    expect(afterCheckoutRes.body.status).toBe("IN_USE");

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/equipment/${equipmentId}/reservations/${reservationId}/checkin`)
      .set(auth)
      .expect(201)
      .then((res) => expect(res.body.checkedInAt).not.toBeNull());

    const afterCheckinRes = await request(app.getHttpServer()).get(`/v1/churches/${churchId}/equipment/${equipmentId}`).set(auth).expect(200);
    expect(afterCheckinRes.body.status).toBe("AVAILABLE");

    await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/equipment/${equipmentId}/maintenance`)
      .set(auth)
      .send({ performedAt: "2026-06-01T00:00:00.000Z", description: "Replaced battery", cost: 12.5 })
      .expect(201);

    // Live fault alert: a connected, church-verified client must receive
    // equipment.fault_reported the moment a fault is reported via REST.
    const client = await connectClient(session.accessToken);
    const joinResult = await new Promise((resolve) => client.emit("join", { churchId }, resolve));
    expect((joinResult as { joined: boolean }).joined).toBe(true);

    const faultEventPromise = new Promise<any>((resolve) => client.once("equipment.fault_reported", resolve));

    const faultRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchId}/equipment/${equipmentId}/faults`)
      .set(auth)
      .send({ severity: "CRITICAL", description: "Battery not holding charge" })
      .expect(201);
    const faultId = faultRes.body.id;

    const faultEvent = await faultEventPromise;
    expect(faultEvent.equipmentId).toBe(equipmentId);
    expect(faultEvent.equipmentName).toBe("Wireless Mic 3");
    expect(faultEvent.severity).toBe("CRITICAL");

    await request(app.getHttpServer())
      .patch(`/v1/churches/${churchId}/equipment/${equipmentId}/faults/${faultId}/resolve`)
      .set(auth)
      .expect(200)
      .then((res) => expect(res.body.resolvedAt).not.toBeNull());

    const detailRes = await request(app.getHttpServer()).get(`/v1/churches/${churchId}/equipment/${equipmentId}`).set(auth).expect(200);
    expect(detailRes.body.maintenanceRecords).toHaveLength(1);
    expect(detailRes.body.reservations).toHaveLength(1);
    expect(detailRes.body.faultReports).toHaveLength(1);

    client.disconnect();
  }, 15000);

  it("blocks cross-tenant access to equipment", async () => {
    const churchA = await registerChurch("Church A Equipment", "admin-a-equip@example.com");
    const churchB = await registerChurch("Church B Equipment", "admin-b-equip@example.com");
    const churchBId = churchB.user.memberships[0].churchId;

    await request(app.getHttpServer())
      .get(`/v1/churches/${churchBId}/equipment`)
      .set("Authorization", `Bearer ${churchA.accessToken}`)
      .expect(403);
  });
});
