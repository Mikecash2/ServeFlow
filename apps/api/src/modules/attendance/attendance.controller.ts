import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AttendanceRepository } from "./attendance.repository";
import { ServicesRepository } from "../services/services.repository";
import { VolunteersRepository } from "../volunteers/volunteers.repository";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { AuthenticatedUser } from "../auth/auth.types";
import { checkInSchema, CheckInDto } from "./dto/checkin.dto";

@Controller("churches/:churchId/services/:serviceId/attendance")
@UseGuards(PermissionGuard)
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly services: ServicesRepository,
    private readonly volunteers: VolunteersRepository,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Get()
  @RequirePermission({ resource: "attendance", action: "read" })
  async roster(@Param("churchId") churchId: string, @Param("serviceId") serviceId: string) {
    const service = await this.services.findById(churchId, serviceId);
    if (!service) throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Service not found" } });
    return this.attendance.getRoster(churchId, serviceId);
  }

  @Post("checkin")
  @RequirePermission({ resource: "attendance", action: "write" })
  async checkIn(
    @Param("churchId") churchId: string,
    @Param("serviceId") serviceId: string,
    @Body(new ZodValidationPipe(checkInSchema)) dto: CheckInDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const service = await this.services.findById(churchId, serviceId);
    if (!service) throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Service not found" } });
    const volunteer = await this.volunteers.findById(churchId, dto.volunteerProfileId);
    if (!volunteer) throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Volunteer not found" } });

    const result = await this.attendance.checkIn({
      churchId,
      serviceId,
      volunteerProfileId: dto.volunteerProfileId,
      checkedInByUserId: user.id,
      method: dto.method,
      serviceStart: service.serviceStart,
      gpsLat: dto.gpsLat,
      gpsLng: dto.gpsLng,
    });

    this.realtime.emitCheckinRecorded(churchId, {
      serviceId,
      volunteerProfileId: dto.volunteerProfileId,
      firstName: volunteer.firstName,
      lastName: volunteer.lastName,
      isLate: result.isLate,
      checkedInAt: result.checkedInAt,
    });

    return result;
  }
}
