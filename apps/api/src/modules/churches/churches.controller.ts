import { Body, Controller, Get, NotFoundException, Param, Patch } from "@nestjs/common";
import { UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ChurchesRepository } from "../core-data/churches.repository";
import { updateChurchSchema, UpdateChurchDto } from "./dto/update-church.dto";

@Controller("churches")
@UseGuards(PermissionGuard)
export class ChurchesController {
  constructor(private readonly churches: ChurchesRepository) {}

  @Get(":churchId")
  @RequirePermission({ resource: "church", action: "read" })
  async getOne(@Param("churchId") churchId: string) {
    const church = await this.churches.findById(churchId);
    if (!church) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Church not found" } });
    }
    return church;
  }

  @Patch(":churchId")
  @RequirePermission({ resource: "church", action: "write" })
  async update(
    @Param("churchId") churchId: string,
    // Pipe is bound to this parameter only (not method-level @UsePipes),
    // which matters because @UsePipes at the method level would also try
    // to run @Param("churchId")'s plain string through the same object
    // schema and fail every request with a spurious 400.
    @Body(new ZodValidationPipe(updateChurchSchema)) dto: UpdateChurchDto,
  ) {
    return this.churches.update(churchId, dto);
  }
}
