import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { ErrorTrackingService } from "../../src/modules/observability/error-tracking.service";
import { ProductAnalyticsService } from "../../src/modules/observability/product-analytics.service";

describe("ErrorTrackingService", () => {
  it("logs instead of reporting to Sentry when SENTRY_DSN is not configured", () => {
    const config = new ConfigService({});
    const service = new ErrorTrackingService(config);
    service.onModuleInit();
    const spy = vi.spyOn((service as any).logger, "error").mockImplementation(() => {});
    service.captureException(new Error("boom"), { churchId: "c1" });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain("stub");
  });
});

describe("ProductAnalyticsService", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs instead of sending to PostHog when POSTHOG_API_KEY is not configured", () => {
    const config = new ConfigService({});
    const service = new ProductAnalyticsService(config);
    service.onModuleInit();
    const spy = vi.spyOn((service as any).logger, "log").mockImplementation(() => {});
    service.track("church_registered", "user-1", { churchId: "c1" });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain("stub");
  });
});
