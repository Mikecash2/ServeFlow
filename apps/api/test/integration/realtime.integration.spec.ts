import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { io, Socket } from "socket.io-client";
import { AppModule } from "../../src/app.module";
import { HttpExceptionFilter } from "../../src/common/filters/http-exception.filter";
import { resetTestDatabase } from "./setup";

/**
 * Proves docs/02-architecture.md §5's realtime channel actually works:
 * a connected client only receives events for a church it has verified
 * membership in, not events from a church it merely guesses the id of.
 */
describe("Realtime gateway integration", () => {
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

  function joinChurch(socket: Socket, churchId: string): Promise<{ joined: boolean }> {
    return new Promise((resolve) => socket.emit("join", { churchId }, resolve));
  }

  async function registerChurch(churchName: string, email: string) {
    const res = await request(app.getHttpServer())
      .post("/v1/auth/register")
      .send({ email, password: "SuperSecret123", firstName: "Admin", lastName: "User", churchName })
      .expect(201);
    return res.body as { user: { memberships: Array<{ churchId: string }> }; accessToken: string };
  }

  it("delivers task.updated only to clients who joined the owning church's room", async () => {
    const churchA = await registerChurch("Kharis Bristol Realtime", "admin-rt-a@example.com");
    const churchAId = churchA.user.memberships[0].churchId;
    const authA = { Authorization: `Bearer ${churchA.accessToken}` };
    const churchB = await registerChurch("Church B Realtime", "admin-rt-b@example.com");

    const campusesRes = await request(app.getHttpServer()).get(`/v1/churches/${churchAId}/campuses`).set(authA).expect(200);
    const campusId = campusesRes.body[0].id;
    const serviceRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchAId}/services`)
      .set(authA)
      .send({ campusId, type: "SUNDAY_SERVICE", title: "Sunday Service", date: "2026-07-12T09:00:00.000Z", serviceStart: "2026-07-12T09:30:00.000Z" })
      .expect(201);
    const serviceId = serviceRes.body.id;
    const taskRes = await request(app.getHttpServer())
      .post(`/v1/churches/${churchAId}/services/${serviceId}/tasks`)
      .set(authA)
      .send({ phase: "SETUP", title: "Power on rig" })
      .expect(201);
    const taskId = taskRes.body.id;

    const memberClient = await connectClient(churchA.accessToken);
    const outsiderClient = await connectClient(churchB.accessToken);

    const memberJoin = await joinChurch(memberClient, churchAId);
    expect(memberJoin.joined).toBe(true);

    // Church B's admin has no membership in Church A — join must be refused.
    const outsiderJoin = await joinChurch(outsiderClient, churchAId);
    expect(outsiderJoin.joined).toBe(false);

    const memberReceived = new Promise<any>((resolve) => memberClient.once("task.updated", resolve));
    let outsiderReceived = false;
    outsiderClient.once("task.updated", () => {
      outsiderReceived = true;
    });

    await request(app.getHttpServer())
      .patch(`/v1/churches/${churchAId}/services/${serviceId}/tasks/${taskId}`)
      .set(authA)
      .send({ status: "IN_PROGRESS" })
      .expect(200);

    const event = await memberReceived;
    expect(event.id).toBe(taskId);
    expect(event.status).toBe("IN_PROGRESS");
    expect(outsiderReceived).toBe(false);

    memberClient.disconnect();
    outsiderClient.disconnect();
  }, 15000);
});
