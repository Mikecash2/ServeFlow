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
- **Phase 11 — Hardening & Launch Readiness:** done. This is the **last
  phase on the roadmap**. Rate limiting (`@nestjs/throttler`, tighter caps
  on auth/scheduling routes), `helmet()` + an env-configurable CORS
  allowlist (REST and the realtime gateway both), Sentry/PostHog wired
  behind the same real-call-if-configured/log-otherwise pattern as the rest
  of this build, a load test of the scheduling engine (500 volunteers, 15
  roles: seed 5.36s, generate 3.29s, 100% coverage), a WCAG AA accessibility
  pass (three real contrast failures found and fixed, not just checked), a
  backup/restore drill against every table (found and fixed a real FK-order
  bug, full pass after), and a Playwright E2E suite (two full specs,
  typechecked; not executable in this sandbox — see deviation #8).

See `../ServeFlow-Docs/08-roadmap.md` for the full per-phase detail on
what's implemented vs. deliberately simplified in each one — this file only
tracks the running total and the environment-driven deviations below.

All of the above is **built and passing** — 34/34 unit tests, 37/37
integration tests against a real Postgres (including genuine WebSocket
tests with `socket.io-client`), see `apps/api/test`.

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

8. **Playwright E2E specs are written and typecheck clean but don't run in
   this sandbox.** `npx playwright install chromium` fails the same way
   Prisma's engine download does: `cdn.playwright.dev` returns `403
   Connection blocked by network allowlist`. `e2e/tests/onboarding.spec.ts`
   and `e2e/tests/scheduling-cycle.spec.ts` are real, selector-verified
   tests — on a machine with normal network access, `npx playwright install
   && npm run test:e2e` runs them against a live `dev:api` + web server.

9. **Backup/restore uses hand-rolled JSON dump/restore, not `pg_dump`/
   `pg_restore`.** Those binaries aren't present in this sandbox's Postgres
   build (only bare `postgres`/`initdb`/`pg_ctl`). `apps/api/scripts/
   backup-restore-drill.ts` dumps every table to JSON and restores it in
   FK-dependency order instead — proves the same thing (a real restore that
   round-trips every row) without the actual pg_dump binary. On a normal
   deployment, use real `pg_dump`/`pg_restore` or your hosting provider's
   managed backups.

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

```bash
# End-to-end tests (need a running dev:api and dev web server, plus
# Playwright's browser binary — not installable in this sandbox, see
# deviation #8). On a normal machine:
npx playwright install
npm run test:e2e --workspace e2e
```

Demo login after seeding: `admin@kharisbristol.test` / `ChangeMe123!`.
