import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { TeamsRepository } from "./teams.repository";
import { MinistriesRepository } from "../ministries/ministries.repository";
import { createTeamSchema, CreateTeamDto } from "./dto/create-team.dto";

@Controller("churches/:churchId/ministries/:ministryId/teams")
@UseGuards(PermissionGuard)
export class TeamsController {
  constructor(
    private readonly teams: TeamsRepository,
    private readonly ministries: MinistriesRepository,
  ) {}

  private async assertMinistryInChurch(churchId: string, ministryId: string) {
    const ministry = await this.ministries.findById(churchId, ministryId);
    if (!ministry) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Ministry not found" } });
    }
  }

  @Get()
  @RequirePermission({ resource: "team", action: "read" })
  async list(@Param("churchId") churchId: string, @Param("ministryId") ministryId: string) {
    await this.assertMinistryInChurch(churchId, ministryId);
    return this.teams.listForMinistry(churchId, ministryId);
  }

  @Post()
  @RequirePermission({ resource: "team", action: "write" })
  async create(
    @Param("churchId") churchId: string,
    @Param("ministryId") ministryId: string,
    @Body(new ZodValidationPipe(createTeamSchema)) dto: CreateTeamDto,
  ) {
    await this.assertMinistryInChurch(churchId, ministryId);
    return this.teams.create(churchId, ministryId, dto.name);
  }
}
