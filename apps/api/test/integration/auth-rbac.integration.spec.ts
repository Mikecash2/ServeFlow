import { beforeAll, describe, expect, it } from "vitest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { HttpExceptionFilter } from "../../src/common/filters/http-exception.filter";
import { resetTestDatabase } from "./setup";

/**
 * Proves the Phase 1 exit criteria from docs/08-roadmap.md: a Church Admin
 * can onboard, invite/build within their own church, and RBAC blocks access
 * across tenant boundaries — verified here by an automated test, not manual
 * click-through.
 */
describe("Auth & RBAC integration", () => {
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
    return res.body as { user: { id: string; memberships: Array<{ churchId: string }> }; accessToken: string };
  }

  it("health check responds without auth", async () => {
    await request(app.getHttpServer()).get("/health").expect(200);
  });

  it("rejects unauthenticated requests to protected routes", async () => {
    await request(app.getHttpServer()).get("/v1/churches/does-not-matter").expect(401);
  });

  it("lets a Church Admin read and update their own church", async () => {
    const session = await registerChurch("Grace Chapel", "admin-a@example.com");
    const churchId = session.user.memberships[0].churchId;

    const getRes = await request(app.getHttpServer())
      .get(`/v1/churches/${churchId}`)
      .set("Authorization", `Bearer ${session.accessToken}`)
      .expect(200);
    expect(getRes.body.name).toBe("Grace Chapel");

    await request(app.getHttpServer())
      .patch(`/v1/churches/${churchId}`)
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ name: "Grace Chapel Updated" })
      .expect(200);
  });

  it("blocks a Church Admin from reading or listing campuses of a DIFFERENT church", async () => {
    const churchA = await registerChurch("Church A", "admin-b@example.com");
    const churchB = await registerChurch("Church B", "admin-c@example.com");
    const churchBId = churchB.user.memberships[0].churchId;

    // Church A's admin token used against Church B's campus list must be
    // rejected — this is the core multi-tenancy guarantee from
    // docs/02-architecture.md §3, enforced by both PermissionGuard's scope
    // check AND the underlying RLS policy.
    await request(app.getHttpServer())
      .get(`/v1/churches/${churchBId}/campuses`)
      .set("Authorization", `Bearer ${churchA.accessToken}`)
      .expect(403);

    // Church B's own admin can see it fine.
    const ownListRes = await request(app.getHttpServer())
      .get(`/v1/churches/${churchBId}/campuses`)
      .set("Authorization", `Bearer ${churchB.accessToken}`)
      .expect(200);
    expect(ownListRes.body.length).toBeGreaterThanOrEqual(1);
    expect(ownListRes.body[0].name).toBe("Main Campus");
  });

  it("supports refresh token rotation and rejects a reused refresh token", async () => {
    const session = await registerChurch("Church D", "admin-d@example.com");

    const loginRes = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: "admin-d@example.com", password: "SuperSecret123" })
      .expect(200);

    const refreshRes = await request(app.getHttpServer())
      .post("/v1/auth/refresh")
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(200);
    expect(refreshRes.body.accessToken).toBeDefined();

    // Reusing the same (now-rotated) refresh token must fail.
    await request(app.getHttpServer())
      .post("/v1/auth/refresh")
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(401);
  });

  it("rejects login with wrong password", async () => {
    await registerChurch("Church E", "admin-e@example.com");
    await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: "admin-e@example.com", password: "WrongPassword123" })
      .expect(401);
  });
});
