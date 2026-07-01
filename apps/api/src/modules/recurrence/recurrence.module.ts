import { Global, Module } from "@nestjs/common";
import { RecurrenceService } from "./recurrence.service";

// Global: used by Availability (Phase 2), Services (Phase 3), and Calendar
// (Phase 10) — simpler as a global provider than importing it into three
// otherwise-unrelated modules individually.
@Global()
@Module({
  providers: [RecurrenceService],
  exports: [RecurrenceService],
})
export class RecurrenceModule {}
