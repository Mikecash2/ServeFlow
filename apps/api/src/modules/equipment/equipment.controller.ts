import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import * as QRCode from "qrcode";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { EquipmentRepository, EquipmentStatus } from "./equipment.repository";
import { MaintenanceRepository } from "./maintenance.repository";
import { ReservationsRepository } from "./reservations.repository";
import { FaultReportsRepository } from "./fault-reports.repository";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { AuthenticatedUser } from "../auth/auth.types";
import { createEquipmentSchema, CreateEquipmentDto } from "./dto/create-equipment.dto";
import { updateEquipmentStatusSchema, UpdateEquipmentStatusDto } from "./dto/update-status.dto";
import { updateBatterySchema, UpdateBatteryDto } from "./dto/update-battery.dto";
import { addMaintenanceSchema, AddMaintenanceDto } from "./dto/add-maintenance.dto";
import { reserveEquipmentSchema, ReserveEquipmentDto } from "./dto/reserve-equipment.dto";
import { reportFaultSchema, ReportFaultDto } from "./dto/report-fault.dto";

@Controller("churches/:churchId/equipment")
@UseGuards(PermissionGuard)
export class EquipmentController {
  constructor(
    private readonly equipment: EquipmentRepository,
    private readonly maintenance: MaintenanceRepository,
    private readonly reservations: ReservationsRepository,
    private readonly faults: FaultReportsRepository,
    private readonly realtime: RealtimeGateway,
  ) {}

  private async assertExists(churchId: string, equipmentId: string) {
    const item = await this.equipment.findById(churchId, equipmentId);
    if (!item) throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Equipment not found" } });
    return item;
  }

  @Get()
  @RequirePermission({ resource: "equipment", action: "read" })
  async list(@Param("churchId") churchId: string, @Query("category") category?: string, @Query("status") status?: EquipmentStatus) {
    return this.equipment.listForChurch(churchId, category, status);
  }

  @Post()
  @RequirePermission({ resource: "equipment", action: "write" })
  async create(@Param("churchId") churchId: string, @Body(new ZodValidationPipe(createEquipmentSchema)) dto: CreateEquipmentDto) {
    return this.equipment.create({ churchId, ...dto });
  }

  @Get(":equipmentId")
  @RequirePermission({ resource: "equipment", action: "read" })
  async getOne(@Param("churchId") churchId: string, @Param("equipmentId") equipmentId: string) {
    const item = await this.assertExists(churchId, equipmentId);
    const [maintenanceRecords, reservationsList, faultReports] = await Promise.all([
      this.maintenance.listForEquipment(churchId, equipmentId),
      this.reservations.listForEquipment(churchId, equipmentId),
      this.faults.listForEquipment(churchId, equipmentId),
    ]);
    return { ...item, maintenanceRecords, reservations: reservationsList, faultReports };
  }

  @Get(":equipmentId/qrcode")
  @RequirePermission({ resource: "equipment", action: "read" })
  async getQrCode(@Param("churchId") churchId: string, @Param("equipmentId") equipmentId: string) {
    const item = await this.assertExists(churchId, equipmentId);
    const qrImageDataUrl = item.qrCode ? await QRCode.toDataURL(item.qrCode) : null;
    return { qrCode: item.qrCode, qrImageDataUrl };
  }

  @Patch(":equipmentId/status")
  @RequirePermission({ resource: "equipment", action: "write" })
  async updateStatus(
    @Param("churchId") churchId: string,
    @Param("equipmentId") equipmentId: string,
    @Body(new ZodValidationPipe(updateEquipmentStatusSchema)) dto: UpdateEquipmentStatusDto,
  ) {
    await this.assertExists(churchId, equipmentId);
    return this.equipment.updateStatus(churchId, equipmentId, dto.status);
  }

  @Patch(":equipmentId/battery")
  @RequirePermission({ resource: "equipment", action: "write" })
  async updateBattery(
    @Param("churchId") churchId: string,
    @Param("equipmentId") equipmentId: string,
    @Body(new ZodValidationPipe(updateBatterySchema)) dto: UpdateBatteryDto,
  ) {
    await this.assertExists(churchId, equipmentId);
    return this.equipment.updateBattery(churchId, equipmentId, dto.batteryLevelPct);
  }

  @Post(":equipmentId/maintenance")
  @RequirePermission({ resource: "equipment", action: "write" })
  async addMaintenance(
    @Param("churchId") churchId: string,
    @Param("equipmentId") equipmentId: string,
    @Body(new ZodValidationPipe(addMaintenanceSchema)) dto: AddMaintenanceDto,
  ) {
    await this.assertExists(churchId, equipmentId);
    return this.maintenance.add({ churchId, equipmentId, ...dto });
  }

  @Post(":equipmentId/reservations")
  @RequirePermission({ resource: "equipment", action: "write" })
  async reserve(
    @Param("churchId") churchId: string,
    @Param("equipmentId") equipmentId: string,
    @Body(new ZodValidationPipe(reserveEquipmentSchema)) dto: ReserveEquipmentDto,
  ) {
    await this.assertExists(churchId, equipmentId);
    return this.reservations.reserve({ churchId, equipmentId, ...dto });
  }

  @Post(":equipmentId/reservations/:reservationId/checkout")
  @RequirePermission({ resource: "equipment", action: "write" })
  async checkOut(
    @Param("churchId") churchId: string,
    @Param("equipmentId") equipmentId: string,
    @Param("reservationId") reservationId: string,
  ) {
    await this.assertExists(churchId, equipmentId);
    const reservation = await this.reservations.checkOut(churchId, reservationId);
    if (!reservation) throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Reservation not found" } });
    await this.equipment.updateStatus(churchId, equipmentId, "IN_USE");
    return reservation;
  }

  @Post(":equipmentId/reservations/:reservationId/checkin")
  @RequirePermission({ resource: "equipment", action: "write" })
  async checkIn(
    @Param("churchId") churchId: string,
    @Param("equipmentId") equipmentId: string,
    @Param("reservationId") reservationId: string,
  ) {
    await this.assertExists(churchId, equipmentId);
    const reservation = await this.reservations.checkIn(churchId, reservationId);
    if (!reservation) throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Reservation not found" } });
    await this.equipment.updateStatus(churchId, equipmentId, "AVAILABLE");
    return reservation;
  }

  @Post(":equipmentId/faults")
  @RequirePermission({ resource: "equipment", action: "write" })
  async reportFault(
    @Param("churchId") churchId: string,
    @Param("equipmentId") equipmentId: string,
    @Body(new ZodValidationPipe(reportFaultSchema)) dto: ReportFaultDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const item = await this.assertExists(churchId, equipmentId);
    const fault = await this.faults.create({ churchId, equipmentId, reportedById: user.id, ...dto });
    // Real-time alert (docs/08-roadmap.md Phase 6 exit criteria): leaders
    // watching the live dashboard see this the moment it's reported.
    this.realtime.emitEquipmentFault(churchId, { ...fault, equipmentName: item.name });
    return fault;
  }

  @Patch(":equipmentId/faults/:faultId/resolve")
  @RequirePermission({ resource: "equipment", action: "write" })
  async resolveFault(
    @Param("churchId") churchId: string,
    @Param("equipmentId") equipmentId: string,
    @Param("faultId") faultId: string,
  ) {
    await this.assertExists(churchId, equipmentId);
    const resolved = await this.faults.resolve(churchId, faultId);
    if (!resolved) throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Fault report not found" } });
    return resolved;
  }
}
