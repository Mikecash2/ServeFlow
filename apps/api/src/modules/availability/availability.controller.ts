import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AvailabilityRepository } from "./availability.repository";
import { VolunteersRepository } from "../volunteers/volunteers.repository";
import { RecurrenceService } from "../recurrence/recurrence.service";
import { submitAvailabilitySchema, SubmitAvailabilityDto } from "./dto/submit-availability.dto";
import { updateAvailabilitySchema, UpdateAvailabilityDto } from "./dto/update-availability.dto";
import {
  submitRecurringAvailabilitySchema,
  SubmitRecurringAvailabilityDto,
} from "./dto/submit-recurring-availability.dto";

@Controller("churches/:churchId/volunteers/:volunteerId/availability")
@UseGuards(PermissionGuard)
export class AvailabilityController {
  constructor(
    private readonly availability: AvailabilityRepository,
    private readonly volunteers: VolunteersRepository,
    private readonly recurrence: RecurrenceService,
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

  /**
   * Closes the Phase 2 deferral: expands an RRULE (e.g. "unavailable every
   * 2nd Sunday") into individual Availability rows across [from, to], via
   * the RecurrenceService built for Phase 10's calendar view.
   */
  @Post("recurring")
  @RequirePermission({ resource: "volunteer", action: "write" })
  async submitRecurring(
    @Param("churchId") churchId: string,
    @Param("volunteerId") volunteerId: string,
    @Body(new ZodValidationPipe(submitRecurringAvailabilitySchema)) dto: SubmitRecurringAvailabilityDto,
  ) {
    await this.assertVolunteerExists(churchId, volunteerId);
    const fromDate = new Date(`${dto.from}T00:00:00.000Z`);
    const toDate = new Date(`${dto.to}T00:00:00.000Z`);
    const occurrences = this.recurrence.expand(dto.recurrenceRule, fromDate, fromDate, toDate);
    const dates = occurrences.map((d) => d.toISOString().slice(0, 10));
    return this.availability.submitBulk({
      churchId,
      volunteerProfileId: volunteerId,
      dates,
      status: dto.status,
      recurrenceRule: dto.recurrenceRule,
      note: dto.note,
    });
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
