import { Module } from "@nestjs/common";
import { TasksController } from "./tasks.controller";
import { TasksRepository } from "./tasks.repository";
import { ServicesModule } from "../services/services.module";

@Module({
  imports: [ServicesModule],
  controllers: [TasksController],
  providers: [TasksRepository],
})
export class TasksModule {}
