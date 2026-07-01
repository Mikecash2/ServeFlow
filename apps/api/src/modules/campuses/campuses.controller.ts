import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CampusesRepository } from "../core-data/campuses.repository";
import { createCampusSchema, CreateCampusDto } from "./dto/create-campus.dto";

@Controller("churches/:churchId/campuses")
@UseGuards(PermissionGuard)
export class CampusesController {
  constructor(private readonly campuses: CampusesRepository) {}

  @Get()
  @RequirePermission({ resource: "campus", action: "read" })
  async list(@Param("churchId") churchId: string) {
    return this.campuses.listForChurch(churchId);
  }

  @Post()
  @RequirePermission({ resource: "campus", action: "write" })
  async create(
    @Param("churchId") churchId: string,
    @Body(new ZodValidationPipe(createCampusSchema)) dto: CreateCampusDto,
  ) {
    return this.campuses.create({ churchId, name: dto.name, isPrimary: dto.isPrimary });
  }

  @Get(":campusId")
  @RequirePermission({ resource: "campus", action: "read" })
  async getOne(@Param("churchId") churchId: string, @Param("campusId") campusId: string) {
    const campus = await this.campuses.findById(churchId, campusId);
    if (!campus) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Campus not found" } });
    }
    return campus;
  }
}
