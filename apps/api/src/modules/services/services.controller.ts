import { Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ServicesRepository, ServiceType } from "./services.repository";
import { createServiceSchema, CreateServiceDto } from "./dto/create-service.dto";
import { updateServiceSchema, UpdateServiceDto } from "./dto/update-service.dto";

@Controller("churches/:churchId/services")
@UseGuards(PermissionGuard)
export class ServicesController {
  constructor(private readonly services: ServicesRepository) {}

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
