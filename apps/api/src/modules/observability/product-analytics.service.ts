import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PostHog } from "posthog-node";

/**
 * Real PostHog integration when POSTHOG_API_KEY is configured. No PostHog
 * account exists in this sandbox, so without a key this logs the event
 * instead of sending it — same pattern as every other deferred-integration
 * point in this build (see serveflow/README.md).
 */
@Injectable()
export class ProductAnalyticsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("ProductAnalytics");
  private client: PostHog | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const apiKey = this.config.get<string>("POSTHOG_API_KEY");
    if (apiKey) {
      this.client = new PostHog(apiKey, { host: this.config.get<string>("POSTHOG_HOST") ?? "https://app.posthog.com" });
    }
  }

  async onModuleDestroy() {
    await this.client?.shutdown();
  }

  track(event: string, distinctId: string, properties?: Record<string, unknown>) {
    if (this.client) {
      this.client.capture({ distinctId, event, properties });
      return;
    }
    this.logger.log(`[stub — POSTHOG_API_KEY not configured] ${event} (${distinctId}) ${properties ? JSON.stringify(properties) : ""}`);
  }
}
