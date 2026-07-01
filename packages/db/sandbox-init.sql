-- ServeFlow — sandbox bootstrap schema (Phase 1: Auth & RBAC tables only)
--
-- WHY THIS FILE EXISTS: this development sandbox cannot reach
-- binaries.prisma.sh (Prisma's engine CDN is not on the network allowlist),
-- so the Prisma CLI (`prisma generate` / `migrate dev`) cannot run here.
-- `prisma/schema.prisma` remains the authoritative schema for the whole
-- product. This file is a hand-written, functionally-equivalent bootstrap
-- for JUST the Phase 1 tables, so the API can be built and tested against a
-- real Postgres in this environment right now.
--
-- ON A MACHINE WITH NORMAL NETWORK ACCESS: ignore this file. Run
-- `npm run db:migrate` (prisma migrate dev) against `prisma/schema.prisma`
-- instead — it will generate the authoritative migration covering every
-- model, including the ones not yet needed for Phase 1. Do not hand-extend
-- this file for future phases; extend schema.prisma and let Prisma generate
-- the migration.

create extension if not exists pgcrypto;

create type church_role as enum (
  'CHURCH_ADMIN', 'CAMPUS_ADMIN', 'MINISTRY_LEADER', 'TEAM_LEADER', 'VOLUNTEER', 'GUEST'
);

create type global_role as enum ('SYSTEM_OWNER', 'PLATFORM_ADMIN', 'NONE');

create table churches (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text,
  secondary_color text,
  timezone text not null default 'UTC',
  address text,
  website text,
  subscription_plan text not null default 'TRIAL',
  subscription_status text not null default 'TRIALING',
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campuses (
  id text primary key default gen_random_uuid()::text,
  church_id text not null references churches(id) on delete cascade,
  name text not null,
  address text,
  timezone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on campuses(church_id);

create table users (
  id text primary key default gen_random_uuid()::text,
  email text not null unique,
  phone text,
  first_name text not null,
  last_name text not null,
  photo_url text,
  password_hash text,
  global_role global_role not null default 'NONE',
  mfa_enabled boolean not null default false,
  mfa_secret text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table memberships (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references users(id) on delete cascade,
  church_id text not null references churches(id) on delete cascade,
  campus_id text references campuses(id) on delete cascade,
  ministry_id text, -- FK added once ministries table exists (Phase 2)
  role church_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, church_id, campus_id, ministry_id, role)
);
create index on memberships(church_id);
create index on memberships(user_id);

create table permissions (
  id text primary key default gen_random_uuid()::text,
  church_id text references churches(id) on delete cascade,
  role church_role not null,
  resource text not null,
  action text not null,
  allowed boolean not null default true,
  unique (church_id, role, resource, action)
);

create table refresh_tokens (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index on refresh_tokens(user_id);

create table audit_logs (
  id text primary key default gen_random_uuid()::text,
  church_id text not null references churches(id) on delete cascade,
  actor_id text not null references users(id),
  action text not null,
  resource_type text not null,
  resource_id text not null,
  before_json jsonb,
  after_json jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);
create index on audit_logs(church_id, created_at);
create index on audit_logs(resource_type, resource_id);

-- Row-Level Security (architecture doc §3): every tenant table is scoped by
-- church_id via a session variable set per-request/transaction. The `app`
-- Postgres role used by the API is granted only through these policies —
-- it has no bypassrls privilege.
alter table campuses enable row level security;
alter table memberships enable row level security;
alter table audit_logs enable row level security;

create policy tenant_isolation_campuses on campuses
  using (church_id = current_setting('app.current_church_id', true));

create policy tenant_isolation_memberships on memberships
  using (church_id = current_setting('app.current_church_id', true));

create policy tenant_isolation_audit_logs on audit_logs
  using (church_id = current_setting('app.current_church_id', true));

-- Platform-level operations (onboarding a brand-new church, System
-- Owner/Platform Admin tooling) run through a separate connection role that
-- bypasses RLS explicitly rather than never setting the session variable —
-- see apps/api/src/prisma/tenant-context.ts.

-- Default permission matrix (platform-wide, church_id null) — mirrors the
-- DEFAULT_PERMISSIONS list in packages/db/prisma/seed.ts. Kept here too
-- (not just in the Prisma seed script) because sandbox-init.sql is the only
-- bootstrap path available in this network-restricted sandbox; a real
-- deployment seeds this via `npm run db:seed` (Prisma) instead, and should
-- keep the two lists in sync if either changes.
insert into permissions (role, resource, action, allowed, church_id) values
  ('CHURCH_ADMIN', 'church', 'read', true, null),
  ('CHURCH_ADMIN', 'church', 'write', true, null),
  ('CHURCH_ADMIN', 'church', 'delete', true, null),
  ('CHURCH_ADMIN', 'campus', 'read', true, null),
  ('CHURCH_ADMIN', 'campus', 'write', true, null),
  ('CHURCH_ADMIN', 'campus', 'delete', true, null),
  ('CHURCH_ADMIN', 'ministry', 'read', true, null),
  ('CHURCH_ADMIN', 'ministry', 'write', true, null),
  ('CHURCH_ADMIN', 'ministry', 'delete', true, null),
  ('CHURCH_ADMIN', 'volunteer', 'read', true, null),
  ('CHURCH_ADMIN', 'volunteer', 'write', true, null),
  ('CHURCH_ADMIN', 'volunteer', 'delete', true, null),
  ('CHURCH_ADMIN', 'service', 'read', true, null),
  ('CHURCH_ADMIN', 'service', 'write', true, null),
  ('CHURCH_ADMIN', 'service', 'delete', true, null),
  ('CAMPUS_ADMIN', 'campus', 'read', true, null),
  ('CAMPUS_ADMIN', 'campus', 'write', true, null),
  ('CAMPUS_ADMIN', 'ministry', 'read', true, null),
  ('CAMPUS_ADMIN', 'ministry', 'write', true, null),
  ('CAMPUS_ADMIN', 'volunteer', 'read', true, null),
  ('CAMPUS_ADMIN', 'volunteer', 'write', true, null),
  ('CAMPUS_ADMIN', 'service', 'read', true, null),
  ('CAMPUS_ADMIN', 'service', 'write', true, null),
  ('MINISTRY_LEADER', 'ministry', 'read', true, null),
  ('MINISTRY_LEADER', 'volunteer', 'read', true, null),
  ('MINISTRY_LEADER', 'volunteer', 'write', true, null),
  ('MINISTRY_LEADER', 'service', 'read', true, null),
  ('MINISTRY_LEADER', 'service', 'write', true, null),
  ('TEAM_LEADER', 'service', 'read', true, null),
  ('TEAM_LEADER', 'volunteer', 'read', true, null),
  ('VOLUNTEER', 'service', 'read', true, null),
  ('VOLUNTEER', 'volunteer', 'read', true, null),
  ('GUEST', 'service', 'read', true, null);
