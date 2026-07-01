import { Module } from "@nestjs/common";
import { SchedulingController } from "./scheduling.controller";
import { SchedulingService } from "./scheduling.service";
import { ScoringService } from "./scoring.service";
import { CandidatesRepository } from "./candidates.repository";
import { ScheduleRunsRepository } from "./schedule-runs.repository";
import { ServiceRolesModule } from "../service-roles/service-roles.module";
import { ServicesModule } from "../services/services.module";
import { VolunteersModule } from "../volunteers/volunteers.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [ServiceRolesModule, ServicesModule, VolunteersModule, NotificationsModule],
  controllers: [SchedulingController],
  providers: [SchedulingService, ScoringService, CandidatesRepository, ScheduleRunsRepository],
  exports: [CandidatesRepository, ScheduleRunsRepository],
})
export class SchedulingModule {}
