import { describe, expect, it, vi } from "vitest";
import { ExecutionContext } from "@nestjs/common";
import { PermissionGuard } from "../../src/modules/rbac/permission.guard";
import { AuthenticatedUser } from "../../src/modules/auth/auth.types";

function makeContext(params: { user?: AuthenticatedUser; requestParams?: Record<string, string>; permission?: unknown }) {
  const reflector = { get: vi.fn().mockReturnValue(params.permission) } as any;
  const request = { user: params.user, params: params.requestParams ?? {}, body: {} };
  const context = {
    getHandler: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { reflector, context };
}

const churchAdminUser: AuthenticatedUser = {
  id: "user-1",
  email: "a@example.com",
  firstName: "A",
  lastName: "B",
  globalRole: "NONE",
  memberships: [
    { id: "m1", churchId: "church-a", campusId: null, ministryId: null, role: "CHURCH_ADMIN" },
  ],
};

describe("PermissionGuard", () => {
  it("allows the route through when no permission metadata is declared", async () => {
    const permissions = { isAllowed: vi.fn() } as any;
    const { reflector, context } = makeContext({ permission: undefined, user: churchAdminUser });
    const guard = new PermissionGuard(reflector, permissions);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(permissions.isAllowed).not.toHaveBeenCalled();
  });

  it("rejects when there is no membership in the target church", async () => {
    const permissions = { isAllowed: vi.fn().mockResolvedValue(true) } as any;
    const { reflector, context } = makeContext({
      permission: { resource: "campus", action: "read" },
      user: churchAdminUser,
      requestParams: { churchId: "church-b" }, // user only has a membership in church-a
    });
    const guard = new PermissionGuard(reflector, permissions);
    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  it("allows a CHURCH_ADMIN to act on any campus within their own church", async () => {
    const permissions = { isAllowed: vi.fn().mockResolvedValue(true) } as any;
    const { reflector, context } = makeContext({
      permission: { resource: "campus", action: "write" },
      user: churchAdminUser,
      requestParams: { churchId: "church-a", campusId: "some-campus" },
    });
    const guard = new PermissionGuard(reflector, permissions);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rejects a CAMPUS_ADMIN scoped to a different campus than the route targets", async () => {
    const campusAdminUser: AuthenticatedUser = {
      ...churchAdminUser,
      memberships: [
        { id: "m2", churchId: "church-a", campusId: "campus-1", ministryId: null, role: "CAMPUS_ADMIN" },
      ],
    };
    const permissions = { isAllowed: vi.fn().mockResolvedValue(true) } as any;
    const { reflector, context } = makeContext({
      permission: { resource: "campus", action: "write" },
      user: campusAdminUser,
      requestParams: { churchId: "church-a", campusId: "campus-2" },
    });
    const guard = new PermissionGuard(reflector, permissions);
    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  it("rejects when the role is not allowed the resource/action at all", async () => {
    const permissions = { isAllowed: vi.fn().mockResolvedValue(false) } as any;
    const { reflector, context } = makeContext({
      permission: { resource: "campus", action: "delete" },
      user: churchAdminUser,
      requestParams: { churchId: "church-a" },
    });
    const guard = new PermissionGuard(reflector, permissions);
    await expect(guard.canActivate(context)).rejects.toThrow();
  });
});
