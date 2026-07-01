# ServeFlow

Monorepo for the ServeFlow platform. See `../ServeFlow-Docs` for the PRD,
architecture, API spec, AI scheduling design, and roadmap.

## Status

- **Phase 1 — Auth & RBAC foundation:** done. Local JWT auth (provider-agnostic —
  Supabase/Clerk can replace `LocalAuthProvider` in
  `apps/api/src/modules/auth/providers` later without touching call sites),
  Church/Campus CRUD, Membership-based RBAC with a `PermissionGuard`, and
  Postgres Row-Level Security as a second enforcement layer.
- **Phase 2 — Ministry & Volunteer Management:** done. Ministry/Team CRUD,
  volunteer invite + profile (skills, certifications, training records,
  status), availability submission and listing by date range. Seed data
  models Kharis Bristol's Production ministry / Production Team.
- **Phase 3 — Services & Tasks:** done. Service CRUD, ServiceRole with
  optional required-skill + min experience level, Task module (phases,
  dependencies, status, photo URLs), checklist templates + per-service
  checklist instances with item completion.
- **Phase 4 — AI Scheduling Engine:** done. Hard-constraint candidate
  resolution (active status, ministry membership, availability, required
  skills, no double-booking), 5-factor weighted scoring, greedy per-role
  fill, explainability endpoint, manual override. Runs synchronously
  in-request rather than as a queued job with WebSocket progress (no
  Redis/BullMQ in this sandbox — see deviation #3 below).
- **Phase 5 — Dashboard & Live Day-Of View:** done. `GET
  /churches/:churchId/dashboard` aggregates coverage %, availability %,
  setup/de-rig progress, missing volunteers, and AI recommendations in one
  call; a WebSocket gateway (`/realtime` namespace) broadcasts task-status
  updates to clients with verified church membership, shown live on the
  service detail page.
- **Phase 6 — Equipment Management:** done. Inventory with auto-generated QR
  codes (rendered to a scannable PNG on demand via the `qrcode` package),
  reservations with checkout/checkin status transitions, maintenance
  history, and fault reporting that broadcasts a live
  `equipment.fault_reported` alert over the same realtime gateway.
- **Phase 7 — Attendance & Check-in:** done. QR/manual/GPS check-in with
  lateness detection against the service's start time, a live attendance
  roster (assignments joined with check-in state), a live
  `checkin.recorded` event, and a reliability-score recompute endpoint that
  feeds real attendance history back into the Phase 4 scheduler's
  `reliability` scoring factor. Runs on-demand rather than as a nightly cron
  job — see deviation #5 below.
- **Next up — Phase 8:** Messaging (in-app + email).

All of the above is **built and passing** — 40/40 tests (19 unit, 21
integration against a real Postgres, including three genuine WebSocket tests
with `socket.io-client`), see `apps/api/test`.

### Deviations from the long-term architecture doc (all environment-driven, all documented at the call site too)

1. **Package manager: npm workspaces**, not pnpm/Turborepo. This dev sandbox
   couldn't install pnpm globally (no write access to the global bin dir).
   Functionally equivalent for every phase so far; revisit when setting up
   real CI/CD on a machine where that's not a constraint.

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
   progress.** No Redis is available in this sandbox (no Docker, no root to
   install a system package). `SchedulingService.generateSchedule` runs
   in-request and returns the complete result immediately, which is fine at
   the scale documented in `docs/04-ai-scheduling-algorithm.md` §9 (well
   under a second for a typical 5-15 role service). Swapping to a queued job
   with progress streamed over WebSocket later is additive — the method
   signature doesn't change, only what calls it.

4. **Dashboard aggregation is REST, not GraphQL**, and **the realtime
   gateway has no Redis pub/sub adapter.** Both for the same underlying
   reason as #3 (no Redis, and standing up a whole GraphQL server for one
   resolver isn't proportionate). The realtime gateway (`/realtime`
   namespace, see `apps/api/src/modules/realtime`) works correctly for a
   single running instance — it verifies church membership before letting a
   client join a room — but only fans out to clients connected to *that*
   process. Horizontal scaling needs `@socket.io/redis-adapter` wired in,
   which is additive once Redis exists.

5. **Reliability score recomputation is an on-demand endpoint, not a
   nightly cron job.** No scheduler/cron infrastructure exists in this
   sandbox. `POST /churches/:churchId/reliability/recompute` runs the exact
   same `ReliabilityService.recomputeForChurch` logic a real cron trigger
   would call — wiring it to an actual schedule (Vercel/Fly.io cron, or a
   BullMQ repeatable job once Redis exists) is additive, not a rework.

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
# packages/db/sandbox-init.sql and prove real behavior — cross-tenant RLS
# isolation, skill-based scheduling exclusion, WebSocket room membership,
# live fault/check-in alerts, etc. — not just that endpoints return 200.
DATABASE_URL=postgresql://serveflow:serveflow@localhost:5432/serveflow \
JWT_ACCESS_SECRET=test JWT_REFRESH_SECRET=test \
npm run test:integration --workspace apps/api
```

Demo login after seeding: `admin@kharisbristol.test` / `ChangeMe123!`.
