import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { RealtimeGateway } from "./realtime.gateway";

// Global: TasksController and SchedulingService both need to emit events
// through this gateway without every module in between having to import it.
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
