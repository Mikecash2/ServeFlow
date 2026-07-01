import { Body, Controller, Get, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { MinistriesRepository } from "./ministries.repository";
import { createMinistrySchema, CreateMinistryDto } from "./dto/create-ministry.dto";
import { updateMinistrySchema, UpdateMinistryDto } from "./dto/update-ministry.dto";

@Controller("churches/:churchId/ministries")
@UseGuards(PermissionGuard)
export class MinistriesController {
  constructor(private readonly ministries: MinistriesRepository) {}

  @Get()
  @RequirePermission({ resource: "ministry", action: "read" })
  async list(@Param("churchId") churchId: string) {
    return this.ministries.listForChurch(churchId);
  }

  @Post()
  @RequirePermission({ resource: "ministry", action: "write" })
  async create(
    @Param("churchId") churchId: string,
    @Body(new ZodValidationPipe(createMinistrySchema)) dto: CreateMinistryDto,
  ) {
    return this.ministries.create({ churchId, ...dto });
  }

  @Get(":ministryId")
  @RequirePermission({ resource: "ministry", action: "read" })
  async getOne(@Param("churchId") churchId: string, @Param("ministryId") ministryId: string) {
    const ministry = await this.ministries.findById(churchId, ministryId);
    if (!ministry) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Ministry not found" } });
    }
    return ministry;
  }

  @Patch(":ministryId")
  @RequirePermission({ resource: "ministry", action: "write" })
  async update(
    @Param("churchId") churchId: string,
    @Param("ministryId") ministryId: string,
    @Body(new ZodValidationPipe(updateMinistrySchema)) dto: UpdateMinistryDto,
  ) {
    const updated = await this.ministries.update(churchId, ministryId, dto);
    if (!updated) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Ministry not found" } });
    }
    return updated;
  }
}
