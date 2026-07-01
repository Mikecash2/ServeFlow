import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSION_KEY, RequiredPermission } from "../../common/decorators/require-permission.decorator";
import { PermissionsRepository } from "./permissions.repository";
import { AuthenticatedUser, MembershipSummary } from "../auth/auth.types";

/**
 * Enforces docs/02-architecture.md §4: resolves the caller's memberships
 * (attached to request.user by JwtAuthGuard), finds the membership matching
 * the resource's scope (church/campus/ministry from route params), and
 * checks the Permission table for that role+resource+action.
 *
 * This guard checks *capability* (can a CHURCH_ADMIN write campuses at all).
 * It also enforces *scope* (is this membership actually for the church
 * being modified) by comparing request.params.churchId (or campusId's
 * parent church, resolved by the controller) against the membership found.
 * A caller with no membership in the target church is rejected even if some
 * other membership of theirs would technically pass the resource/action
 * check — this is what stops a Campus Admin at Campus A from touching
 * Campus B.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<RequiredPermission | undefined>(
      PERMISSION_KEY,
      context.getHandler(),
    );
    if (!required) return true; // route did not declare a permission requirement

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) {
      throw new ForbiddenException({
        error: { code: "FORBIDDEN", message: "No authenticated user on request" },
      });
    }

    const targetChurchId: string | undefined =
      request.params?.churchId ?? request.body?.churchId;

    const candidateMemberships = targetChurchId
      ? user.memberships.filter((m) => m.churchId === targetChurchId)
      : user.memberships;

    if (targetChurchId && candidateMemberships.length === 0) {
      throw new ForbiddenException({
        error: {
          code: "FORBIDDEN",
          message: "You do not have a role in this church",
        },
      });
    }

    for (const membership of candidateMemberships) {
      const allowed = await this.permissions.isAllowed({
        role: membership.role,
        resource: required.resource,
        action: required.action,
        churchId: membership.churchId,
      });
      if (allowed && this.scopeMatches(membership, request)) {
        return true;
      }
    }

    throw new ForbiddenException({
      error: {
        code: "FORBIDDEN",
        message: `Missing permission: ${required.action} on ${required.resource}`,
      },
    });
  }

  /**
   * A CAMPUS_ADMIN/MINISTRY_LEADER/TEAM_LEADER membership must additionally
   * match the campusId/ministryId in the route, if present — a CHURCH_ADMIN
   * membership (campusId/ministryId both null) matches any scope within
   * the church.
   */
  private scopeMatches(membership: MembershipSummary, request: any): boolean {
    if (membership.role === "CHURCH_ADMIN") return true;

    const routeCampusId: string | undefined = request.params?.campusId;
    if (routeCampusId && membership.campusId && membership.campusId !== routeCampusId) {
      return false;
    }
    return true;
  }
}
