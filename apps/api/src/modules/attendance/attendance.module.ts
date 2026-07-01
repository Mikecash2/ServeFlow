import { Module } from "@nestjs/common";
import { AttendanceController } from "./attendance.controller";
import { AttendanceRepository } from "./attendance.repository";
import { ReliabilityController } from "./reliability.controller";
import { ReliabilityService } from "./reliability.service";
import { ServicesModule } from "../services/services.module";
import { VolunteersModule } from "../volunteers/volunteers.module";

@Module({
  imports: [ServicesModule, VolunteersModule],
  controllers: [AttendanceController, ReliabilityController],
  providers: [AttendanceRepository, ReliabilityService],
})
export class AttendanceModule {}
