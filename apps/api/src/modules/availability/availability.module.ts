import { Module } from "@nestjs/common";
import { AvailabilityController } from "./availability.controller";
import { AvailabilityRepository } from "./availability.repository";
import { VolunteersModule } from "../volunteers/volunteers.module";

@Module({
  imports: [VolunteersModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityRepository],
})
export class AvailabilityModule {}
