# ServeFlow

Monorepo for the ServeFlow platform. See `../ServeFlow-Docs` for the PRD,
architecture, API spec, AI scheduling design, and roadmap.

## Status

- **Phase 1 — Auth & RBAC foundation:** done.
- **Phase 2 — Ministry & Volunteer Management:** done.
- **Phase 3 — Services & Tasks:** done.
- **Phase 4 — AI Scheduling Engine:** done. Runs synchronously in-request
  (no Redis/BullMQ in this sandbox — deviation #3).
- **Phase 5 — Dashboard & Live Day-Of View:** done. REST aggregation +
  WebSocket gateway (deviation #4).
- **Phase 6 — Equipment Management:** done. QR codes, reservations,
  checkout/checkin, maintenance, live fault alerts.
- **Phase 7 — Attendance & Check-in:** done. Check-in, lateness, live
  roster, on-demand reliability recompute (deviation #5).
- **Phase 8 — Messaging (in-app + email):** done. Channels, read receipts,
  Resend-backed notifications (deviation #6), confirm/decline with re-solve.
- **Phase 9 — Analytics & AI Assistant:** done. Coverage/reliability/
  burnout/equipment analytics; assistant answers all 4 PRD example
  questions via keyword-matched safe query templates (deviation #7).
- **Phase 10 — Calendar:** done. ICS export (`GET
  /churches/:churchId/calendar.ics`), month/agenda web view, and real RRULE
  expansion (`rrule` package) closing the recurring-availability (Phase 2)
  and recurring-service (Phase 3) deferrals — `POST
  .../availability/recurring` and `POST
  .../services/:serviceId/generate-recurring`.
- **Next up — Phase 11 (final phase on the roadmap):** Hardening & Launch
  Readiness — OWASP pass, rate limiting, load testing, Sentry/PostHog,
  accessibility audit, Playwright E2E, and switching from
  `sandbox-init.sql`/raw `pg` to real Prisma migrations on a machine with
  network access.

See `../ServeFlow-Docs/08-roadmap.md` for the full per-phase detail on
what's implemented vs. deliberately simplified in each one — this file only
tracks the running total and the environment-driven deviations below.

All of the above is **built and passing** — 30/30 unit tests, 37/37
integration tests against a real Postgres (including three genuine
WebSocket tests with `socket.io-client`), see `apps/api/test`.

### Deviations from the long-term architecture doc (all environment-driven, all documented at the call site too)

1. **Package manager: npm workspaces**, not pnpm/Turborepo. This dev sandbox
   couldn't install pnpm globally (no write access to the global bin dir).

2. **Database access: raw `pg` + hand-written SQL**, not `@prisma/client`,
   at runtime. This sandbox cannot reach `binaries.prisma.sh` (Prisma's
   engine CDN isn't on its network allowlist), so the Prisma CLI/runtime
   can't function here. **`packages/db/prisma/schema.prisma` is still the
   authoritative schema** for the whole product —
   `packages/db/sandbox-init.sql` is a hand-written, functionally-equivalent
   bootstrap used only to unblock building and testing in this environment.
   **On a normal machine with full network access:** run `npm run db:migrate`
   (Prisma) against `schema.prisma` instead of `sandbox-init.sql`, and switch
   `apps/api/src/database/database.service.ts` to wrap `PrismaClient`. The
   repository classes (`ChurchesRepository`, `VolunteersRepository`, etc.)
   expose the same methods either way, so no call sites elsewhere change.

3. **AI scheduling runs synchronously, not via BullMQ + Redis + WebSocket
   progress.** No Redis is available in this sandbox. Swapping to a queued
   job with progress streamed over WebSocket later is additive.

4. **Dashboard aggregation is REST, not GraphQL**, and **the realtime
   gateway has no Redis pub/sub adapter.** Both for the same underlying
   reason as #3. The realtime gateway (`/realtime` namespace) verifies
   church membership before letting a client join a room, but only fans out
   to clients connected to the single running process.

5. **Reliability score recomputation is an on-demand endpoint, not a
   nightly cron job.** No scheduler/cron infrastructure exists in this
   sandbox. `POST /churches/:churchId/reliability/recompute` runs the exact
   logic a real cron trigger would call.

6. **Email notifications are logged, not actually delivered.** No Resend
   account exists in this sandbox. `EmailNotificationChannel` implements
   the real Resend API call and takes the same code path whether or not
   `RESEND_API_KEY` is set — without a key it logs instead of throwing.

7. **The AI Assistant classifies intent with keyword/regex matching, not an
   LLM.** No LLM API key is configured in this sandbox.
   `IntentClassifierService` maps a question to one of a fixed set of safe,
   parameterized query templates — the safety property the architecture doc
   calls for — via pattern matching instead of an LLM picking the template.

## Local development (on a normal machine)

```bash
docker compose up -d          # Postgres + Redis
cp .env.example apps/api/.env
npm install
npm run db:generate           # prisma generate
npm run db:migrate            # prisma migrate dev, against schema.prisma
npm run db:seed               # seeds default permissions + Kharis Bristol demo data
npm run dev:api
```

API runs on http://localhost:3001. Web app: `npm run dev --workspace apps/web`
(http://localhost:3000).

## Running tests

```bash
# Unit tests (no DB needed)
npm run test --workspace apps/api

# Integration tests (need Postgres running — docker compose up -d, or point
# DATABASE_URL at any local Postgres). These reset the schema using
# packages/db/sandbox-init.sql and prove real behavior, not just that
# endpoints return 200.
DATABASE_URL=postgresql://serveflow:serveflow@localhost:5432/serveflow \
JWT_ACCESS_SECRET=test JWT_REFRESH_SECRET=test \
npm run test:integration --workspace apps/api
```

Demo login after seeding: `admin@kharisbristol.test` / `ChangeMe123!`.
