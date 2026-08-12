-- =====================================================================
-- ATTENDANCE SUPABASE — DATABASE SCHEMA
-- ---------------------------------------------------------------------
-- Run this in your SEPARATE attendance Supabase project's SQL editor.
--
-- This creates:
--   1. All 5 attendance tables
--   2. Indexes for common queries
--   3. Row Level Security policies
--   4. The private storage bucket for photos
-- =====================================================================

-- =====================================================================
-- 1. TABLES
-- =====================================================================

-- ---- attendance_employees ---------------------------------------------
create table if not exists attendance_employees (
  id              uuid primary key default gen_random_uuid(),
  employee_code   text unique not null,
  name            text not null,
  phone           text not null,
  department      text not null,
  role            text not null default 'Staff',
  profile_photo   text,
  password_hash   text,
  status          text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_attendance_employees_status on attendance_employees (status);
create index if not exists idx_attendance_employees_department on attendance_employees (department);

-- ---- attendance_records -----------------------------------------------
create table if not exists attendance_records (
  id                    uuid primary key default gen_random_uuid(),
  employee_id           uuid not null references attendance_employees(id) on delete cascade,
  attendance_date       date not null,
  check_in_time         timestamptz,
  check_out_time        timestamptz,
  check_in_photo        text,
  check_out_photo       text,
  check_in_latitude     double precision,
  check_in_longitude    double precision,
  check_out_latitude    double precision,
  check_out_longitude   double precision,
  check_in_location_id  text,
  check_out_location_id text,
  check_in_distance     double precision,
  check_out_distance    double precision,
  check_in_reason       text,
  check_out_reason      text,
  working_minutes       integer,
  status                text not null default 'PRESENT'
    check (status in ('PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'CANCELLED')),
  marked_by             text not null default 'staff',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (employee_id, attendance_date)
);
-- Existing deployments: add the reason columns if they're missing.
alter table attendance_records add column if not exists check_in_reason text;
alter table attendance_records add column if not exists check_out_reason text;
create index if not exists idx_attendance_records_date on attendance_records (attendance_date);
create index if not exists idx_attendance_records_status on attendance_records (status);
create index if not exists idx_attendance_records_emp_date on attendance_records (employee_id, attendance_date);

-- ---- attendance_locations ---------------------------------------------
create table if not exists attendance_locations (
  id             uuid primary key default gen_random_uuid(),
  name           text unique not null,
  latitude       double precision not null,
  longitude      double precision not null,
  allowed_radius integer not null default 200,
  status         text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---- attendance_settings (singleton) ----------------------------------
create table if not exists attendance_settings (
  id                              text primary key default 'singleton',
  office_start_time               text not null default '09:00',
  office_end_time                 text not null default '18:00',
  check_in_early_window_minutes   integer not null default 45,
  check_out_early_window_minutes  integer not null default 180,
  reason_options                  jsonb not null default '["Traffic","Personal work","Emergency","Family issue","Travel","Other"]',
  late_after_minutes              integer not null default 15,
  half_day_after_minutes          integer not null default 120,
  minimum_working_minutes         integer not null default 480,
  require_photo                   boolean not null default true,
  require_location                boolean not null default true,
  timezone                        text not null default 'Asia/Kolkata',
  updated_at                      timestamptz not null default now()
);
-- Existing deployments: add the new settings columns if they're missing.
alter table attendance_settings add column if not exists office_end_time text not null default '18:00';
alter table attendance_settings add column if not exists check_in_early_window_minutes integer not null default 45;
alter table attendance_settings add column if not exists check_out_early_window_minutes integer not null default 180;
alter table attendance_settings add column if not exists reason_options jsonb not null default '["Traffic","Personal work","Emergency","Family issue","Travel","Other"]';
insert into attendance_settings (id) values ('singleton')
  on conflict (id) do nothing;

-- ---- attendance_audit_logs --------------------------------------------
create table if not exists attendance_audit_logs (
  id                    uuid primary key default gen_random_uuid(),
  admin_user_identifier text not null,
  action                text not null,
  entity_type           text not null,
  entity_id             text,
  old_value             jsonb,
  new_value             jsonb,
  created_at            timestamptz not null default now()
);
create index if not exists idx_attendance_audit_entity on attendance_audit_logs (entity_type, entity_id);
create index if not exists idx_attendance_audit_created on attendance_audit_logs (created_at);

-- =====================================================================
-- 1.6 SALARY MODULE TABLES
-- =====================================================================
-- Per-employee monthly salary configuration. Admin sets base + allowances
-- + deductions; the system auto-calculates payable salary based on
-- attendance (present days, late, half-day, absent beyond allowed holidays).

create table if not exists attendance_salary_settings (
  id                  uuid primary key default gen_random_uuid(),
  employee_id         uuid not null unique references attendance_employees(id) on delete cascade,
  base_salary         numeric(12,2) not null default 0,
  hra_allowance       numeric(12,2) not null default 0,
  travel_allowance    numeric(12,2) not null default 0,
  special_allowance   numeric(12,2) not null default 0,
  pf_deduction        numeric(12,2) not null default 0,
  other_deduction     numeric(12,2) not null default 0,
  -- Holidays allowed per month (default 2). Extra absences → salary deduction.
  allowed_holidays_per_month integer not null default 2,
  -- Per-day rate used for deductions. NULL → auto-computed (base / 30).
  per_day_rate_override numeric(12,2),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_salary_settings_employee on attendance_salary_settings (employee_id);

-- Computed monthly salary records. One row per employee per month.
-- Generated by the system when admin clicks "Calculate Salary".
create table if not exists attendance_salary_records (
  id                  uuid primary key default gen_random_uuid(),
  employee_id         uuid not null references attendance_employees(id) on delete cascade,
  month               integer not null check (month between 1 and 12),
  year                integer not null check (year between 2000 and 2100),
  -- Attendance counts for the month
  present_days        integer not null default 0,
  late_days           integer not null default 0,
  half_days           integer not null default 0,
  absent_days         integer not null default 0,
  on_leave_days       integer not null default 0,
  working_days_in_month integer not null default 30,
  -- Salary components (copied from settings at calc time)
  base_salary         numeric(12,2) not null default 0,
  total_allowances    numeric(12,2) not null default 0,
  total_deductions    numeric(12,2) not null default 0,
  -- Attendance-based adjustment (deduction for excess absences)
  attendance_deduction numeric(12,2) not null default 0,
  -- Final payable
  gross_salary        numeric(12,2) not null default 0,
  net_salary          numeric(12,2) not null default 0,
  -- Status: DRAFT → APPROVED → PAID
  status              text not null default 'DRAFT'
    check (status in ('DRAFT', 'APPROVED', 'PAID')),
  -- Audit
  computed_by         text not null default 'admin',
  approved_by         text,
  approved_at         timestamptz,
  paid_at             timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (employee_id, month, year)
);
create index if not exists idx_salary_records_emp on attendance_salary_records (employee_id);
create index if not exists idx_salary_records_period on attendance_salary_records (year, month);
create index if not exists idx_salary_records_status on attendance_salary_records (status);

-- =====================================================================
-- 1.7 COMPANY RESOURCES (brochures, docs, policies — staff-facing)
-- =====================================================================
-- Admin uploads files (PDFs, images, brochures) to Supabase Storage
-- bucket 'company-resources'. Metadata lives here. Staff can browse
-- via the staff portal.

create table if not exists attendance_company_resources (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  -- Category for grouping in the staff portal
  category    text not null default 'General'
    check (category in ('General', 'Brochure', 'Policy', 'Form', 'Notice', 'Training', 'Other')),
  -- Storage path in the 'company-resources' bucket
  file_path   text not null,
  file_type   text not null default 'application/pdf',
  file_size   bigint not null default 0,
  -- Visibility: who can see this resource
  visibility  text not null default 'ALL'
    check (visibility in ('ALL', 'DEPARTMENT')),
  -- If visibility = DEPARTMENT, only this department sees it
  department_filter text,
  -- Sort order + active flag
  sort_order  integer not null default 0,
  status      text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'INACTIVE')),
  uploaded_by text not null default 'admin',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_resources_category on attendance_company_resources (category);
create index if not exists idx_resources_status on attendance_company_resources (status);

-- =====================================================================
-- 2. ROW LEVEL SECURITY
-- =====================================================================
-- Enable RLS on all tables. The service-role key bypasses RLS (server-
-- side only). The anon key is subject to these policies.

alter table attendance_employees        enable row level security;
alter table attendance_records          enable row level security;
alter table attendance_locations        enable row level security;
alter table attendance_settings         enable row level security;
alter table attendance_audit_logs       enable row level security;
alter table attendance_salary_settings  enable row level security;
alter table attendance_salary_records   enable row level security;
alter table attendance_company_resources enable row level security;

-- Settings + locations are readable by anyone (public anon key).
-- Writes go through the server (service-role key).
-- Note: PostgreSQL doesn't support `create policy if not exists`, so we
-- drop first to make this script safe to re-run.
drop policy if exists "public read settings" on attendance_settings;
create policy "public read settings"
  on attendance_settings for select using (true);

drop policy if exists "public read active locations" on attendance_locations;
create policy "public read active locations"
  on attendance_locations for select using (true);

-- Employees: readable by anyone (admin dashboard needs the list).
-- Password hash column should be excluded in select queries (done in code).
drop policy if exists "public read employees" on attendance_employees;
create policy "public read employees"
  on attendance_employees for select using (true);

-- Records: readable by anyone with anon key (admin dashboard).
-- Staff self-service writes go through the server (service-role key).
drop policy if exists "public read records" on attendance_records;
create policy "public read records"
  on attendance_records for select using (true);

-- Audit logs: NO public read policy → only service-role key can read.
-- (No policy = deny for anon/authenticated roles.)

-- Salary settings + records + company resources: readable by anyone with
-- anon key (admin dashboard reads them; staff portal reads their own).
-- Writes go through the server (service-role key) with admin auth check.
drop policy if exists "public read salary settings" on attendance_salary_settings;
create policy "public read salary settings"
  on attendance_salary_settings for select using (true);

drop policy if exists "public read salary records" on attendance_salary_records;
create policy "public read salary records"
  on attendance_salary_records for select using (true);

drop policy if exists "public read active resources" on attendance_company_resources;
create policy "public read active resources"
  on attendance_company_resources for select using (status = 'ACTIVE');

-- =====================================================================
-- 3. STORAGE BUCKETS
-- =====================================================================
-- Two private buckets:
--   1. attendance-photos  — check-in/out selfies
--   2. company-resources  — brochures, policies, forms (staff-facing)

insert into storage.buckets (id, name, public)
values
  ('attendance-photos', 'attendance-photos', false),
  ('company-resources', 'company-resources', false)
on conflict (id) do nothing;

-- Storage policies: only the service-role key (server) can upload and
-- create signed URLs. Staff/admin browsers never touch storage directly.
-- (No storage object policies = deny for anon/authenticated roles.)

-- =====================================================================
-- DONE
-- =====================================================================
-- After running this, go to:
--   Project Settings → API
-- and copy:
--   - Project URL  → NEXT_PUBLIC_ATTENDANCE_SUPABASE_URL
--   - anon key     → NEXT_PUBLIC_ATTENDANCE_SUPABASE_ANON_KEY
--   - service_role → ATTENDANCE_SUPABASE_SERVICE_ROLE_KEY
-- =====================================================================
