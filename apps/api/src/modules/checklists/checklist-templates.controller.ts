import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ChecklistsRepository, ChecklistKind } from "./checklists.repository";
import { createTemplateSchema, CreateTemplateDto } from "./dto/create-template.dto";
import { addTemplateItemSchema, AddTemplateItemDto } from "./dto/add-template-item.dto";

@Controller("churches/:churchId/checklist-templates")
@UseGuards(PermissionGuard)
export class ChecklistTemplatesController {
  constructor(private readonly checklists: ChecklistsRepository) {}

  private async assertTemplateExists(churchId: string, templateId: string) {
    const template = await this.checklists.findTemplateById(churchId, templateId);
    if (!template) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Checklist template not found" } });
    }
    return template;
  }

  @Get()
  @RequirePermission({ resource: "checklist", action: "read" })
  async list(@Param("churchId") churchId: string) {
    return this.checklists.listTemplates(churchId);
  }

  @Post()
  @RequirePermission({ resource: "checklist", action: "write" })
  async create(
    @Param("churchId") churchId: string,
    @Body(new ZodValidationPipe(createTemplateSchema)) dto: CreateTemplateDto,
  ) {
    return this.checklists.createTemplate({ churchId, ...dto });
  }

  @Get(":templateId/items")
  @RequirePermission({ resource: "checklist", action: "read" })
  async listItems(@Param("churchId") churchId: string, @Param("templateId") templateId: string) {
    await this.assertTemplateExists(churchId, templateId);
    return this.checklists.listItems(churchId, templateId);
  }

  @Post(":templateId/items")
  @RequirePermission({ resource: "checklist", action: "write" })
  async addItem(
    @Param("churchId") churchId: string,
    @Param("templateId") templateId: string,
    @Body(new ZodValidationPipe(addTemplateItemSchema)) dto: AddTemplateItemDto,
  ) {
    await this.assertTemplateExists(churchId, templateId);
    return this.checklists.addItem({ churchId, templateId, ...dto });
  }
}
