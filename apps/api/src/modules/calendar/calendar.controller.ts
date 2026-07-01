import { Controller, Get, Header, NotFoundException, Param, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CalendarService } from "./calendar.service";
import { ChurchesRepository } from "../core-data/churches.repository";

@Controller("churches/:churchId")
@UseGuards(PermissionGuard)
export class CalendarController {
  constructor(
    private readonly calendar: CalendarService,
    private readonly churches: ChurchesRepository,
  ) {}

  @Get("calendar.ics")
  @RequirePermission({ resource: "service", action: "read" })
  @Header("Content-Type", "text/calendar; charset=utf-8")
  async icsFeed(@Param("churchId") churchId: string): Promise<string> {
    const church = await this.churches.findById(churchId);
    if (!church) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Church not found" } });
    }
    return this.calendar.generateIcsFeed(churchId, church.name);
  }
}
