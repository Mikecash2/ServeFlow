import { Module } from "@nestjs/common";
import { MinistriesController } from "./ministries.controller";
import { MinistriesRepository } from "./ministries.repository";

@Module({
  controllers: [MinistriesController],
  providers: [MinistriesRepository],
  exports: [MinistriesRepository],
})
export class MinistriesModule {}
