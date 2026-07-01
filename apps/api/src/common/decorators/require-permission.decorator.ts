import { SetMetadata } from "@nestjs/common";

export const PERMISSION_KEY = "requiredPermission";

export interface RequiredPermission {
  resource: string;
  action: string;
  /**
   * Where in the request the church/campus/ministry scope ids are found, so
   * PermissionGuard can check the caller's Membership against the *specific*
   * resource being touched, not just "do they have this role anywhere."
   */
  scopeFrom?: "params" | "body";
}

/**
 * Declares the permission a route requires, e.g.:
 *   @RequirePermission({ resource: "campus", action: "write" })
 * PermissionGuard reads this metadata and checks it against the caller's
 * Membership + Permission rows before the handler runs.
 */
export const RequirePermission = (perm: RequiredPermission) =>
  SetMetadata(PERMISSION_KEY, perm);
