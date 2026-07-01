import { Module } from "@nestjs/common";
import { ChurchesController } from "./churches.controller";

@Module({
  controllers: [ChurchesController],
})
export class ChurchesModule {}
