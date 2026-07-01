import { Body, Controller, Get, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ServiceRolesRepository } from "./service-roles.repository";
import { ServicesRepository } from "../services/services.repository";
import { createServiceRoleSchema, CreateServiceRoleDto } from "./dto/create-service-role.dto";
import { updateServiceRoleSchema, UpdateServiceRoleDto } from "./dto/update-service-role.dto";
import { addRequiredSkillSchema, AddRequiredSkillDto } from "./dto/add-required-skill.dto";

@Controller("churches/:churchId/services/:serviceId/roles")
@UseGuards(PermissionGuard)
export class ServiceRolesController {
  constructor(
    private readonly roles: ServiceRolesRepository,
    private readonly services: ServicesRepository,
  ) {}

  private async assertServiceExists(churchId: string, serviceId: string) {
    const service = await this.services.findById(churchId, serviceId);
    if (!service) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Service not found" } });
    }
  }

  private async assertRoleExists(churchId: string, serviceId: string, roleId: string) {
    const role = await this.roles.findById(churchId, serviceId, roleId);
    if (!role) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Service role not found" } });
    }
    return role;
  }

  @Get()
  @RequirePermission({ resource: "service", action: "read" })
  async list(@Param("churchId") churchId: string, @Param("serviceId") serviceId: string) {
    await this.assertServiceExists(churchId, serviceId);
    return this.roles.listForService(churchId, serviceId);
  }

  @Post()
  @RequirePermission({ resource: "service", action: "write" })
  async create(
    @Param("churchId") churchId: string,
    @Param("serviceId") serviceId: string,
    @Body(new ZodValidationPipe(createServiceRoleSchema)) dto: CreateServiceRoleDto,
  ) {
    await this.assertServiceExists(churchId, serviceId);
    return this.roles.create({ churchId, serviceId, ...dto });
  }

  @Patch(":roleId")
  @RequirePermission({ resource: "service", action: "write" })
  async update(
    @Param("churchId") churchId: string,
    @Param("serviceId") serviceId: string,
    @Param("roleId") roleId: string,
    @Body(new ZodValidationPipe(updateServiceRoleSchema)) dto: UpdateServiceRoleDto,
  ) {
    await this.assertRoleExists(churchId, serviceId, roleId);
    return this.roles.update(churchId, roleId, dto);
  }

  @Post(":roleId/skills")
  @RequirePermission({ resource: "service", action: "write" })
  async addSkill(
    @Param("churchId") churchId: string,
    @Param("serviceId") serviceId: string,
    @Param("roleId") roleId: string,
    @Body(new ZodValidationPipe(addRequiredSkillSchema)) dto: AddRequiredSkillDto,
  ) {
    await this.assertRoleExists(churchId, serviceId, roleId);
    return this.roles.addRequiredSkill({ churchId, serviceRoleId: roleId, ...dto });
  }
}
