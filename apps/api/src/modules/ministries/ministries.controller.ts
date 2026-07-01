import { Body, Controller, Get, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { MinistriesRepository } from "./ministries.repository";
import { MembershipsRepository } from "../rbac/memberships.repository";
import { VolunteersRepository } from "../volunteers/volunteers.repository";
import { createMinistrySchema, CreateMinistryDto } from "./dto/create-ministry.dto";
import { updateMinistrySchema, UpdateMinistryDto } from "./dto/update-ministry.dto";

@Controller("churches/:churchId/ministries")
@UseGuards(PermissionGuard)
export class MinistriesController {
  constructor(
    private readonly ministries: MinistriesRepository,
    private readonly memberships: MembershipsRepository,
    private readonly volunteers: VolunteersRepository,
  ) {}

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

  /**
   * Ties an existing volunteer to this ministry so the AI scheduling engine
   * (Phase 4) considers them for the ministry's ServiceRoles. Distinct from
   * the general VOLUNTEER membership created at invite time (see
   * docs/05-user-flows.md §1) — a volunteer can belong to multiple
   * ministries.
   */
  @Post(":ministryId/volunteers/:volunteerId")
  @RequirePermission({ resource: "ministry", action: "write" })
  async addVolunteer(
    @Param("churchId") churchId: string,
    @Param("ministryId") ministryId: string,
    @Param("volunteerId") volunteerId: string,
  ) {
    const ministry = await this.ministries.findById(churchId, ministryId);
    if (!ministry) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Ministry not found" } });
    }
    const volunteer = await this.volunteers.findById(churchId, volunteerId);
    if (!volunteer) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Volunteer not found" } });
    }
    return this.memberships.assignVolunteerToMinistry({ churchId, ministryId, userId: volunteer.userId });
  }
}
