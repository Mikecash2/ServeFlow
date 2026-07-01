import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { DashboardService } from "./dashboard.service";

@Controller("churches/:churchId/dashboard")
@UseGuards(PermissionGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @RequirePermission({ resource: "service", action: "read" })
  async getSummary(@Param("churchId") churchId: string) {
    return this.dashboard.getSummary(churchId);
  }
}
