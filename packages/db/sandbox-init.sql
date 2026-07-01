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

-- ─────────────────────────────────────────────────────────────
-- Phase 2: Ministry & Volunteer Management (sandbox bootstrap)
-- Same caveat as above: hand-written to unblock this network-restricted
-- sandbox. schema.prisma is still authoritative; extend it, not this file,
-- when adding real migrations.
-- ─────────────────────────────────────────────────────────────

create type ministry_category as enum (
  'MEDIA', 'PRODUCTION', 'WORSHIP', 'HOSPITALITY', 'CHILDREN',
  'SECURITY', 'USHERING', 'PRAYER', 'CLEANING', 'CUSTOM'
);

create type volunteer_status as enum ('ACTIVE', 'INACTIVE', 'SUSPENDED');

create type availability_status as enum (
  'AVAILABLE', 'UNAVAILABLE', 'LATE', 'LEAVE_EARLY', 'MAYBE'
);

create table ministries (
  id text primary key default gen_random_uuid()::text,
  church_id text not null references churches(id) on delete cascade,
  campus_id text references campuses(id) on delete cascade,
  name text not null,
  category ministry_category not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on ministries(church_id);

-- Now that ministries exists, wire up the FK memberships.ministry_id was
-- left without (see the Phase 1 comment on that column).
alter table memberships
  add constraint memberships_ministry_id_fkey
  foreign key (ministry_id) references ministries(id) on delete cascade;

create table teams (
  id text primary key default gen_random_uuid()::text,
  ministry_id text not null references ministries(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index on teams(ministry_id);

create table volunteer_profiles (
  id text primary key default gen_random_uuid()::text,
  user_id text not null unique references users(id) on delete cascade,
  church_id text not null references churches(id) on delete cascade,
  emergency_contact_name text,
  emergency_contact_phone text,
  status volunteer_status not null default 'ACTIVE',
  reliability_score double precision not null default 1.0,
  notes text,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on volunteer_profiles(church_id);

create table skills (
  id text primary key default gen_random_uuid()::text,
  church_id text not null references churches(id) on delete cascade,
  name text not null,
  unique (church_id, name)
);

create table volunteer_skills (
  id text primary key default gen_random_uuid()::text,
  volunteer_profile_id text not null references volunteer_profiles(id) on delete cascade,
  skill_id text not null references skills(id) on delete cascade,
  experience_level int not null default 1,
  years_experience double precision,
  unique (volunteer_profile_id, skill_id)
);

create table certifications (
  id text primary key default gen_random_uuid()::text,
  volunteer_profile_id text not null references volunteer_profiles(id) on delete cascade,
  name text not null,
  issued_at timestamptz,
  expires_at timestamptz,
  document_url text
);
create index on certifications(volunteer_profile_id);

create table training_records (
  id text primary key default gen_random_uuid()::text,
  volunteer_profile_id text not null references volunteer_profiles(id) on delete cascade,
  course_name text not null,
  completed_at timestamptz,
  required_for_roles text[] not null default '{}'
);
create index on training_records(volunteer_profile_id);

create table availability (
  id text primary key default gen_random_uuid()::text,
  volunteer_profile_id text not null references volunteer_profiles(id) on delete cascade,
  date date not null,
  status availability_status not null,
  note text,
  recurrence_rule text,
  is_holiday_mode boolean not null default false,
  submitted_at timestamptz not null default now()
);
create index on availability(volunteer_profile_id, date);

-- RLS: ministries/teams/volunteer_profiles/certifications/training_records/
-- availability are all tenant- (or volunteer-, transitively church-) scoped.
-- Skills reference data follows the same "read across churches is safe,
-- writes are scoped by church_id in the query" pattern as `permissions` in
-- Phase 1 rather than RLS, since it's non-sensitive reference data.
alter table ministries enable row level security;
alter table teams enable row level security;
alter table volunteer_profiles enable row level security;
alter table certifications enable row level security;
alter table training_records enable row level security;
alter table availability enable row level security;

create policy tenant_isolation_ministries on ministries
  using (church_id = current_setting('app.current_church_id', true));

create policy tenant_isolation_volunteer_profiles on volunteer_profiles
  using (church_id = current_setting('app.current_church_id', true));

-- teams/certifications/training_records/availability don't carry church_id
-- directly (they hang off ministry_id / volunteer_profile_id) — scope via a
-- join back to the tenant-scoped parent, which Postgres can use an index for.
create policy tenant_isolation_teams on teams
  using (ministry_id in (
    select id from ministries where church_id = current_setting('app.current_church_id', true)
  ));

create policy tenant_isolation_certifications on certifications
  using (volunteer_profile_id in (
    select id from volunteer_profiles where church_id = current_setting('app.current_church_id', true)
  ));

create policy tenant_isolation_training_records on training_records
  using (volunteer_profile_id in (
    select id from volunteer_profiles where church_id = current_setting('app.current_church_id', true)
  ));

create policy tenant_isolation_availability on availability
  using (volunteer_profile_id in (
    select id from volunteer_profiles where church_id = current_setting('app.current_church_id', true)
  ));

-- Additional default permissions for Phase 2 resources not already covered
-- by the Phase 1 matrix above (team-level access, mirrors ministry rules).
insert into permissions (role, resource, action, allowed, church_id) values
  ('CHURCH_ADMIN', 'team', 'read', true, null),
  ('CHURCH_ADMIN', 'team', 'write', true, null),
  ('CHURCH_ADMIN', 'team', 'delete', true, null),
  ('CAMPUS_ADMIN', 'team', 'read', true, null),
  ('CAMPUS_ADMIN', 'team', 'write', true, null),
  ('MINISTRY_LEADER', 'team', 'read', true, null),
  ('MINISTRY_LEADER', 'team', 'write', true, null),
  ('TEAM_LEADER', 'team', 'read', true, null),
  ('VOLUNTEER', 'team', 'read', true, null);

-- volunteer_skills was missed above: it links to volunteer_profile_id (tenant
-- data) even though skills itself is treated as shared reference data.
alter table volunteer_skills enable row level security;
create policy tenant_isolation_volunteer_skills on volunteer_skills
  using (volunteer_profile_id in (
    select id from volunteer_profiles where church_id = current_setting('app.current_church_id', true)
  ));

-- ─────────────────────────────────────────────────────────────
-- Phase 3: Services & Tasks (sandbox bootstrap)
-- Same caveat as above: hand-written to unblock this network-restricted
-- sandbox. schema.prisma is still authoritative.
-- ─────────────────────────────────────────────────────────────

create type service_type as enum (
  'SUNDAY_SERVICE', 'WEDNESDAY_SERVICE', 'PRAYER_MEETING', 'CONFERENCE',
  'WEDDING', 'FUNERAL', 'SPECIAL_EVENT'
);

create type task_phase as enum ('SETUP', 'SERVICE', 'DERIG');

create type task_status as enum ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED');

create type checklist_kind as enum ('SETUP', 'SERVICE', 'EMERGENCY', 'SHUTDOWN', 'DERIG');

create table services (
  id text primary key default gen_random_uuid()::text,
  church_id text not null references churches(id) on delete cascade,
  campus_id text not null references campuses(id) on delete cascade,
  type service_type not null,
  title text not null,
  venue text,
  date timestamptz not null,
  setup_start timestamptz,
  soundcheck timestamptz,
  doors_open timestamptz,
  service_start timestamptz not null,
  service_end timestamptz,
  derig_end timestamptz,
  expected_attendance int,
  notes text,
  guest_speaker text,
  recurrence_rule text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on services(church_id, date);
create index on services(campus_id, date);

create table service_roles (
  id text primary key default gen_random_uuid()::text,
  service_id text not null references services(id) on delete cascade,
  ministry_id text not null references ministries(id) on delete cascade,
  name text not null,
  min_required int not null default 1,
  max_allowed int not null default 1
);
create index on service_roles(service_id);

create table service_role_skills (
  id text primary key default gen_random_uuid()::text,
  service_role_id text not null references service_roles(id) on delete cascade,
  skill_id text not null references skills(id) on delete cascade,
  min_experience_level int not null default 1,
  unique (service_role_id, skill_id)
);

create table tasks (
  id text primary key default gen_random_uuid()::text,
  service_id text not null references services(id) on delete cascade,
  phase task_phase not null,
  title text not null,
  description text,
  priority int not null default 3,
  estimated_minutes int,
  status task_status not null default 'NOT_STARTED',
  assigned_volunteer_id text references volunteer_profiles(id) on delete set null,
  depends_on_task_id text references tasks(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  photo_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index on tasks(service_id, phase);

create table checklist_templates (
  id text primary key default gen_random_uuid()::text,
  church_id text not null references churches(id) on delete cascade,
  kind checklist_kind not null,
  name text not null,
  created_at timestamptz not null default now()
);
create index on checklist_templates(church_id);

create table checklist_template_items (
  id text primary key default gen_random_uuid()::text,
  template_id text not null references checklist_templates(id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  is_required boolean not null default true
);
create index on checklist_template_items(template_id);

create table checklist_instances (
  id text primary key default gen_random_uuid()::text,
  template_id text not null references checklist_templates(id) on delete cascade,
  service_id text not null references services(id) on delete cascade,
  completed_items jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on checklist_instances(service_id);

-- RLS
alter table services enable row level security;
alter table service_roles enable row level security;
alter table service_role_skills enable row level security;
alter table tasks enable row level security;
alter table checklist_templates enable row level security;
alter table checklist_template_items enable row level security;
alter table checklist_instances enable row level security;

create policy tenant_isolation_services on services
  using (church_id = current_setting('app.current_church_id', true));

create policy tenant_isolation_service_roles on service_roles
  using (service_id in (
    select id from services where church_id = current_setting('app.current_church_id', true)
  ));

create policy tenant_isolation_service_role_skills on service_role_skills
  using (service_role_id in (
    select sr.id from service_roles sr
    join services s on s.id = sr.service_id
    where s.church_id = current_setting('app.current_church_id', true)
  ));

create policy tenant_isolation_tasks on tasks
  using (service_id in (
    select id from services where church_id = current_setting('app.current_church_id', true)
  ));

create policy tenant_isolation_checklist_templates on checklist_templates
  using (church_id = current_setting('app.current_church_id', true));

create policy tenant_isolation_checklist_template_items on checklist_template_items
  using (template_id in (
    select id from checklist_templates where church_id = current_setting('app.current_church_id', true)
  ));

create policy tenant_isolation_checklist_instances on checklist_instances
  using (service_id in (
    select id from services where church_id = current_setting('app.current_church_id', true)
  ));

-- Default permissions for the new "task" and "checklist" resources.
-- "service" read/write/delete already exists from the Phase 1 matrix.
insert into permissions (role, resource, action, allowed, church_id) values
  ('CHURCH_ADMIN', 'task', 'read', true, null),
  ('CHURCH_ADMIN', 'task', 'write', true, null),
  ('CHURCH_ADMIN', 'task', 'delete', true, null),
  ('CHURCH_ADMIN', 'checklist', 'read', true, null),
  ('CHURCH_ADMIN', 'checklist', 'write', true, null),
  ('CHURCH_ADMIN', 'checklist', 'delete', true, null),
  ('CAMPUS_ADMIN', 'task', 'read', true, null),
  ('CAMPUS_ADMIN', 'task', 'write', true, null),
  ('CAMPUS_ADMIN', 'checklist', 'read', true, null),
  ('CAMPUS_ADMIN', 'checklist', 'write', true, null),
  ('MINISTRY_LEADER', 'task', 'read', true, null),
  ('MINISTRY_LEADER', 'task', 'write', true, null),
  ('MINISTRY_LEADER', 'checklist', 'read', true, null),
  ('MINISTRY_LEADER', 'checklist', 'write', true, null),
  ('TEAM_LEADER', 'task', 'read', true, null),
  ('TEAM_LEADER', 'task', 'write', true, null),
  ('TEAM_LEADER', 'checklist', 'read', true, null),
  ('VOLUNTEER', 'task', 'read', true, null),
  ('VOLUNTEER', 'checklist', 'read', true, null);

-- ─────────────────────────────────────────────────────────────
-- Phase 4: AI Scheduling Engine (sandbox bootstrap)
-- Same caveat as above: hand-written to unblock this network-restricted
-- sandbox. schema.prisma is still authoritative.
--
-- Simplification vs. schema.prisma: `PreferredRole` (which links a volunteer
-- to a specific ServiceRole row) is replaced here with a plain
-- `preferred_role_names text[]` column on volunteer_profiles. ServiceRole
-- rows are recreated per service occurrence, so "prefers this exact row" is
-- a less useful signal than "prefers roles named X" — matching by name is
-- what the algorithm actually needs. Revisit if/when recurring services
-- (Phase 3's deferred RRULE expansion) makes ServiceRole rows longer-lived.
-- ─────────────────────────────────────────────────────────────

alter table volunteer_profiles add column preferred_role_names text[] not null default '{}';

create type schedule_run_status as enum ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
create type assignment_source as enum ('AI_GENERATED', 'MANUAL_OVERRIDE', 'SELF_SIGNUP');

create table schedule_runs (
  id text primary key default gen_random_uuid()::text,
  service_id text not null references services(id) on delete cascade,
  status schedule_run_status not null default 'PENDING',
  triggered_by_id text not null references users(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  coverage_pct double precision,
  summary text
);
create index on schedule_runs(service_id);

create table assignments (
  id text primary key default gen_random_uuid()::text,
  schedule_run_id text not null references schedule_runs(id) on delete cascade,
  service_role_id text not null references service_roles(id) on delete cascade,
  volunteer_profile_id text not null references volunteer_profiles(id) on delete cascade,
  source assignment_source not null default 'AI_GENERATED',
  score double precision not null,
  reasoning jsonb not null default '{}',
  confirmed_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now()
);
create index on assignments(schedule_run_id);
create index on assignments(volunteer_profile_id);

alter table schedule_runs enable row level security;
alter table assignments enable row level security;

create policy tenant_isolation_schedule_runs on schedule_runs
  using (service_id in (
    select id from services where church_id = current_setting('app.current_church_id', true)
  ));

create policy tenant_isolation_assignments on assignments
  using (schedule_run_id in (
    select sr.id from schedule_runs sr
    join services s on s.id = sr.service_id
    where s.church_id = current_setting('app.current_church_id', true)
  ));
