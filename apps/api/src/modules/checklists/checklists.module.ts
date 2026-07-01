import { Module } from "@nestjs/common";
import { ChecklistTemplatesController } from "./checklist-templates.controller";
import { ChecklistInstancesController } from "./checklist-instances.controller";
import { ChecklistsRepository } from "./checklists.repository";
import { ServicesModule } from "../services/services.module";

@Module({
  imports: [ServicesModule],
  controllers: [ChecklistTemplatesController, ChecklistInstancesController],
  providers: [ChecklistsRepository],
})
export class ChecklistsModule {}
