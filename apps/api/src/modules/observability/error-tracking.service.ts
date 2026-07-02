import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Sentry from "@sentry/node";

/**
 * Real Sentry integration when SENTRY_DSN is configured. This sandbox has
 * no Sentry account (nothing to configure it with — same class of
 * deviation as Resend/LLM/Redis elsewhere in this build), so without a DSN
 * this falls back to structured error logging instead of silently doing
 * nothing. `HttpExceptionFilter` calls this for every unhandled 500.
 */
@Injectable()
export class ErrorTrackingService implements OnModuleInit {
  private readonly logger = new Logger("ErrorTracking");
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const dsn = this.config.get<string>("SENTRY_DSN");
    if (dsn) {
      Sentry.init({ dsn, environment: this.config.get<string>("NODE_ENV") ?? "development" });
      this.enabled = true;
    }
  }

  captureException(error: unknown, context?: Record<string, unknown>) {
    if (this.enabled) {
      Sentry.captureException(error, { extra: context });
      return;
    }
    this.logger.error(
      `[stub — SENTRY_DSN not configured] ${error instanceof Error ? error.stack : String(error)}`,
      context ? JSON.stringify(context) : undefined,
    );
  }
}
