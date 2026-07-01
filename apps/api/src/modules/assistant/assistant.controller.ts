import { Body, Controller, Post, Param, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AssistantService } from "./assistant.service";
import { askSchema, AskDto } from "./dto/ask.dto";

@Controller("churches/:churchId/assistant")
@UseGuards(PermissionGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post("query")
  @RequirePermission({ resource: "assistant", action: "read" })
  async query(@Param("churchId") churchId: string, @Body(new ZodValidationPipe(askSchema)) dto: AskDto) {
    return this.assistant.answer(churchId, dto.question);
  }
}
