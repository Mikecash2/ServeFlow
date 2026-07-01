import { Module } from "@nestjs/common";
import { EquipmentController } from "./equipment.controller";
import { EquipmentRepository } from "./equipment.repository";
import { MaintenanceRepository } from "./maintenance.repository";
import { ReservationsRepository } from "./reservations.repository";
import { FaultReportsRepository } from "./fault-reports.repository";

@Module({
  controllers: [EquipmentController],
  providers: [EquipmentRepository, MaintenanceRepository, ReservationsRepository, FaultReportsRepository],
  exports: [EquipmentRepository],
})
export class EquipmentModule {}
