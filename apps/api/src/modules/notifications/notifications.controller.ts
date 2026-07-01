import { Controller, Get, NotFoundException, Param, Patch, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { NotificationsRepository } from "./notifications.repository";
import { AuthenticatedUser } from "../auth/auth.types";

@Controller("churches/:churchId/notifications")
@UseGuards(PermissionGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsRepository) {}

  @Get()
  @RequirePermission({ resource: "notification", action: "read" })
  async list(@Param("churchId") churchId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notifications.listForUser(churchId, user.id);
  }

  @Patch(":notificationId/read")
  @RequirePermission({ resource: "notification", action: "read" })
  async markRead(
    @Param("churchId") churchId: string,
    @Param("notificationId") notificationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const updated = await this.notifications.markRead(churchId, notificationId, user.id);
    if (!updated) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Notification not found" } });
    }
    return updated;
  }
}
