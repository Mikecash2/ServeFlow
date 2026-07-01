import { Module } from "@nestjs/common";
import { ServicesController } from "./services.controller";
import { ServicesRepository } from "./services.repository";

@Module({
  controllers: [ServicesController],
  providers: [ServicesRepository],
  exports: [ServicesRepository],
})
export class ServicesModule {}
