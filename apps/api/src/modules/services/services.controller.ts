import { Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, BadRequestException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ServicesRepository, ServiceType } from "./services.repository";
import { RecurrenceService } from "../recurrence/recurrence.service";
import { createServiceSchema, CreateServiceDto } from "./dto/create-service.dto";
import { updateServiceSchema, UpdateServiceDto } from "./dto/update-service.dto";
import { generateRecurringSchema, GenerateRecurringDto } from "./dto/generate-recurring.dto";

@Controller("churches/:churchId/services")
@UseGuards(PermissionGuard)
export class ServicesController {
  constructor(
    private readonly services: ServicesRepository,
    private readonly recurrence: RecurrenceService,
  ) {}

  @Get()
  @RequirePermission({ resource: "service", action: "read" })
  async list(
    @Param("churchId") churchId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("type") type?: ServiceType,
  ) {
    return this.services.listForChurch(churchId, from, to, type);
  }

  @Post()
  @RequirePermission({ resource: "service", action: "write" })
  async create(
    @Param("churchId") churchId: string,
    @Body(new ZodValidationPipe(createServiceSchema)) dto: CreateServiceDto,
  ) {
    return this.services.create({ churchId, ...dto });
  }

  @Get(":serviceId")
  @RequirePermission({ resource: "service", action: "read" })
  async getOne(@Param("churchId") churchId: string, @Param("serviceId") serviceId: string) {
    const service = await this.services.findById(churchId, serviceId);
    if (!service) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Service not found" } });
    }
    return service;
  }

  @Patch(":serviceId")
  @RequirePermission({ resource: "service", action: "write" })
  async update(
    @Param("churchId") churchId: string,
    @Param("serviceId") serviceId: string,
    @Body(new ZodValidationPipe(updateServiceSchema)) dto: UpdateServiceDto,
  ) {
    const updated = await this.services.update(churchId, serviceId, dto);
    if (!updated) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Service not found" } });
    }
    return updated;
  }

  /**
   * Closes the Phase 3 deferral: expands this service's own
   * `recurrenceRule` and materializes real Service rows for the next
   * `count` occurrences (see ServicesRepository.createShiftedCopies for
   * what is and isn't copied).
   */
  @Post(":serviceId/generate-recurring")
  @RequirePermission({ resource: "service", action: "write" })
  async generateRecurring(
    @Param("churchId") churchId: string,
    @Param("serviceId") serviceId: string,
    @Body(new ZodValidationPipe(generateRecurringSchema)) dto: GenerateRecurringDto,
  ) {
    const service = await this.services.findById(churchId, serviceId);
    if (!service) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Service not found" } });
    }
    if (!service.recurrenceRule) {
      throw new BadRequestException({
        error: { code: "VALIDATION_ERROR", message: "This service has no recurrenceRule set" },
      });
    }

    const dtstart = new Date(service.serviceStart);
    const rangeFrom = new Date(dtstart.getTime() + 1000); // strictly after the template itself
    const rangeTo = new Date(dtstart.getTime() + 365 * 24 * 60 * 60 * 1000);
    const occurrences = this.recurrence.expand(service.recurrenceRule, dtstart, rangeFrom, rangeTo, dto.count);

    return this.services.createShiftedCopies(churchId, service, occurrences);
  }

  @Delete(":serviceId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission({ resource: "service", action: "delete" })
  async cancel(@Param("churchId") churchId: string, @Param("serviceId") serviceId: string) {
    const deleted = await this.services.cancel(churchId, serviceId);
    if (!deleted) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Service not found" } });
    }
  }
}
