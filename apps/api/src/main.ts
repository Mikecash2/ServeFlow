import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import * as Sentry from "@sentry/node";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

/**
 * CORS_ORIGINS: comma-separated allowlist (e.g.
 * "https://app.serveflow.app,https://staging.serveflow.app"). Defaults to
 * the local web dev server only — docs/08-roadmap.md Phase 11 hardening:
 * the previous `cors: true` reflected *any* request origin, which is fine
 * for early local development but not a production posture. Real
 * deployments set this env var; nothing else about CORS config changes.
 */
function corsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS;
  if (!raw) return ["http://localhost:3000"];
  return raw.split(",").map((o) => o.trim()).filter(Boolean);
}

async function bootstrap() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV ?? "development" });
  }

  const app = await NestFactory.create(AppModule, {
    cors: { origin: corsOrigins(), credentials: true },
  });

  // helmet sets the standard OWASP-recommended response headers
  // (X-Content-Type-Options, X-Frame-Options, a conservative default CSP,
  // etc.) — see docs/08-roadmap.md Phase 11.
  app.use(helmet());

  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix("v1", { exclude: ["health"] });

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`ServeFlow API listening on http://localhost:${port}`);
}

bootstrap();
