import { Global, Module } from "@nestjs/common";
import { ErrorTrackingService } from "./error-tracking.service";
import { ProductAnalyticsService } from "./product-analytics.service";

@Global()
@Module({
  providers: [ErrorTrackingService, ProductAnalyticsService],
  exports: [ErrorTrackingService, ProductAnalyticsService],
})
export class ObservabilityModule {}
