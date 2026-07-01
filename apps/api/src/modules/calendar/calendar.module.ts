import { Module } from "@nestjs/common";
import { CalendarController } from "./calendar.controller";
import { CalendarService } from "./calendar.service";
import { ServicesModule } from "../services/services.module";

@Module({
  imports: [ServicesModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
