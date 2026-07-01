import { Module } from "@nestjs/common";
import { MinistriesController } from "./ministries.controller";
import { MinistriesRepository } from "./ministries.repository";
import { VolunteersModule } from "../volunteers/volunteers.module";

@Module({
  imports: [VolunteersModule],
  controllers: [MinistriesController],
  providers: [MinistriesRepository],
  exports: [MinistriesRepository],
})
export class MinistriesModule {}
