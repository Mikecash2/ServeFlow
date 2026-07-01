# ServeFlow

Monorepo for the ServeFlow platform. See `../ServeFlow-Docs` for the PRD,
architecture, API spec, AI scheduling design, and roadmap.

## Phase 1 scope (current) — Auth & RBAC foundation

Local JWT auth (provider-agnostic — Supabase/Clerk can replace
`LocalAuthProvider` in `apps/api/src/modules/auth/providers` later without
touching call sites), Church/Campus CRUD, Membership-based RBAC with a
`PermissionGuard`, and Postgres Row-Level Security as a second enforcement
layer. Status: **built and passing** — 17/17 tests (11 unit, 6 integration
against a real Postgres), see `apps/api/test`.

### Deviations from the long-term architecture doc (both intentional, both environment-driven)

1. **Package manager: npm workspaces**, not pnpm/Turborepo. This dev sandbox
   couldn't install pnpm globally (no write access to the global bin dir).
   Functionally equivalent for Phase 1; revisit when se