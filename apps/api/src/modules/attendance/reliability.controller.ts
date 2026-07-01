import { Controller, Post, Param, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { ReliabilityService } from "./reliability.service";

@Controller("churches/:churchId/reliability")
@UseGuards(PermissionGuard)
export class ReliabilityController {
  constructor(private readonly reliability: ReliabilityService) {}

  @Post("recompute")
  @RequirePermission({ resource: "volunteer", action: "write" })
  async recompute(@Param("churchId") churchId: string) {
    const results = await this.reliability.recomputeForChurch(churchId);
    return { updated: results.length, results };
  }
}
