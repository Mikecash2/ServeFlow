import { Body, Controller, Get, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ChecklistsRepository } from "./checklists.repository";
import { ServicesRepository } from "../services/services.repository";
import { AuthenticatedUser } from "../auth/auth.types";
import { instantiateChecklistSchema, InstantiateChecklistDto } from "./dto/instantiate-checklist.dto";
import { completeItemSchema, CompleteItemDto } from "./dto/complete-item.dto";

@Controller("churches/:churchId/services/:serviceId/checklist-instances")
@UseGuards(PermissionGuard)
export class ChecklistInstancesController {
  constructor(
    private readonly checklists: ChecklistsRepository,
    private readonly services: ServicesRepository,
  ) {}

  private async assertServiceExists(churchId: string, serviceId: string) {
    const service = await this.services.findById(churchId, serviceId);
    if (!service) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Service not found" } });
    }
  }

  @Get()
  @RequirePermission({ resource: "checklist", action: "read" })
  async list(@Param("churchId") churchId: string, @Param("serviceId") serviceId: string) {
    await this.assertServiceExists(churchId, serviceId);
    return this.checklists.listInstancesForService(churchId, serviceId);
  }

  @Post()
  @RequirePermission({ resource: "checklist", action: "write" })
  async instantiate(
    @Param("churchId") churchId: string,
    @Param("serviceId") serviceId: string,
    @Body(new ZodValidationPipe(instantiateChecklistSchema)) dto: InstantiateChecklistDto,
  ) {
    await this.assertServiceExists(churchId, serviceId);
    const template = await this.checklists.findTemplateById(churchId, dto.templateId);
    if (!template) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Checklist template not found" } });
    }
    return this.checklists.instantiate({ churchId, serviceId, templateId: dto.templateId });
  }

  @Patch(":instanceId/items/:itemId")
  @RequirePermission({ resource: "checklist", action: "write" })
  async completeItem(
    @Param("churchId") churchId: string,
    @Param("serviceId") serviceId: string,
    @Param("instanceId") instanceId: string,
    @Param("itemId") itemId: string,
    @Body(new ZodValidationPipe(completeItemSchema)) dto: CompleteItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const instance = await this.checklists.findInstanceById(churchId, serviceId, instanceId);
    if (!instance) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Checklist instance not found" } });
    }
    return this.checklists.completeItem({ churchId, instanceId, itemId, completedBy: user.id, ...dto });
  }
}
