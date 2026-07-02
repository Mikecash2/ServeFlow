import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";
import * as Sentry from "@sentry/node";

/**
 * Normalizes every thrown error into the API spec's error envelope:
 * { error: { code, message, details? } }. Errors that already carry that
 * shape (e.g. from ZodValidationPipe) pass through unchanged; anything else
 * (including unexpected 500s) is mapped to a stable code so clients never
 * have to branch on framework-specific error shapes.
 *
 * This filter is constructed manually (`new HttpExceptionFilter()` in
 * main.ts / tests) rather than via Nest's DI as an APP_FILTER provider, so
 * it can't constructor-inject ErrorTrackingService — it reads SENTRY_DSN
 * directly instead (the same pattern Sentry's own NestJS docs use for
 * exception filters specifically). Sentry.init() is a no-op here if
 * SENTRY_DSN was never set (no Sentry account in this sandbox — see
 * serveflow/README.md), so captureException below just does nothing rather
 * than throwing.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "object" && body !== null && "error" in body) {
        response.status(status).json(body);
        return;
      }
      response.status(status).json({
        error: {
          code: this.codeForStatus(status),
          message: exception.message,
        },
      });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(exception);
    }
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    });
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return "VALIDATION_ERROR";
      case HttpStatus.UNAUTHORIZED:
        return "UNAUTHORIZED";
      case HttpStatus.FORBIDDEN:
        return "FORBIDDEN";
      case HttpStatus.NOT_FOUND:
        return "NOT_FOUND";
      case HttpStatus.CONFLICT:
        return "CONFLICT";
      case HttpStatus.TOO_MANY_REQUESTS:
        return "RATE_LIMITED";
      default:
        return "ERROR";
    }
  }
}
