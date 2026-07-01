import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AvailabilityRepository } from "./availability.repository";
import { VolunteersRepository } from "../volunteers/volunteers.repository";
import { submitAvailabilitySchema, SubmitAvailabilityDto } from "./dto/submit-availability.dto";
import { updateAvailabilitySchema, UpdateAvailabilityDto } from "./dto/update-availability.dto";

@Controller("churches/:churchId/volunteers/:volunteerId/availability")
@UseGuards(PermissionGuard)
export class AvailabilityController {
  constructor(
    private readonly availability: AvailabilityRepository,
    private readonly volunteers: VolunteersRepository,
  ) {}

  private async assertVolunteerExists(churchId: string, volunteerId: string) {
    const profile = await this.volunteers.findById(churchId, volunteerId);
    if (!profile) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Volunteer not found" } });
    }
  }

  @Get()
  @RequirePermission({ resource: "volunteer", action: "read" })
  async list(
    @Param("churchId") churchId: string,
    @Param("volunteerId") volunteerId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    await this.assertVolunteerExists(churchId, volunteerId);
    return this.availability.listForVolunteer(churchId, volunteerId, from, to);
  }

  @Post()
  @RequirePermission({ resource: "volunteer", action: "write" })
  async submit(
    @Param("churchId") churchId: string,
    @Param("volunteerId") volunteerId: string,
    @Body(new ZodValidationPipe(submitAvailabilitySchema)) dto: SubmitAvailabilityDto,
  ) {
    await this.assertVolunteerExists(churchId, volunteerId);
    return this.availability.submit({ churchId, volunteerProfileId: volunteerId, ...dto });
  }

  @Patch(":availabilityId")
  @RequirePermission({ resource: "volunteer", action: "write" })
  async update(
    @Param("churchId") churchId: string,
    @Param("volunteerId") volunteerId: string,
    @Param("availabilityId") availabilityId: string,
    @Body(new ZodValidationPipe(updateAvailabilitySchema)) dto: UpdateAvailabilityDto,
  ) {
    await this.assertVolunteerExists(churchId, volunteerId);
    const updated = await this.availability.update(churchId, availabilityId, dto);
    if (!updated) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Availability record not found" } });
    }
    return updated;
  }
}
