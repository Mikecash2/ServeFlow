import { Module } from "@nestjs/common";
import { AssistantController } from "./assistant.controller";
import { AssistantService } from "./assistant.service";
import { IntentClassifierService } from "./intent-classifier.service";
import { AssistantQueriesRepository } from "./assistant-queries.repository";
import { ServicesModule } from "../services/services.module";
import { ServiceRolesModule } from "../service-roles/service-roles.module";
import { SchedulingModule } from "../scheduling/scheduling.module";

@Module({
  imports: [ServicesModule, ServiceRolesModule, SchedulingModule],
  controllers: [AssistantController],
  providers: [AssistantService, IntentClassifierService, AssistantQueriesRepository],
})
export class AssistantModule {}
