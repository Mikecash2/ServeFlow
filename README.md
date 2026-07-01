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
- **Next up — Phase 3:** Services & Tasks.

All of the above is **built and passing** — 20/20 tests (11 unit, 9 integration
against a real Postgres), see `apps/api/test`.

### Deviations from the long-term architecture doc (both intentional, both environment-driven)

1. **Package manager: npm workspaces**, not pnpm/Turborepo. This dev sandbox
   couldn't install pnpm globally (no write access to the global bin dir).
   Functionally equivalent for Phase 1; revisit when se