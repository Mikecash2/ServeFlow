import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { AnalyticsRepository } from "./analytics.repository";

@Controller("churches/:churchId/analytics")
@UseGuards(PermissionGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsRepository) {}

  @Get("coverage")
  @RequirePermission({ resource: "analytics", action: "read" })
  async coverage(@Param("churchId") churchId: string, @Query("from") from?: string, @Query("to") to?: string) {
    return this.analytics.getCoverageTrend(churchId, from, to);
  }

  @Get("reliability")
  @RequirePermission({ resource: "analytics", action: "read" })
  async reliability(@Param("churchId") churchId: string) {
    return this.analytics.getReliabilityDistribution(churchId);
  }

  @Get("burnout-risk")
  @RequirePermission({ resource: "analytics", action: "read" })
  async burnoutRisk(@Param("churchId") churchId: string) {
    return this.analytics.getBurnoutRisk(churchId);
  }

  @Get("equipment-usage")
  @RequirePermission({ resource: "analytics", action: "read" })
  async equipmentUsage(@Param("churchId") churchId: string) {
    return this.analytics.getEquipmentUsage(churchId);
  }
}
