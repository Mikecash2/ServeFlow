import { Module } from "@nestjs/common";
import { CampusesController } from "./campuses.controller";

@Module({
  controllers: [CampusesController],
})
export class CampusesModule {}
