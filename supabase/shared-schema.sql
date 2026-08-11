-- ============================================================
-- VGG INTEGRATED SCHEMA — Website + Agent PWA (shared Supabase)
-- ============================================================
-- This migration creates ALL tables used by BOTH projects:
--
--   1. Website content tables (13 tables)
--      - Used by the admin dashboard + public website
--      - Hero banners, gallery, amenities, testimonials, FAQs, team,
--        offers, brochures, news, nearby places, videos, stats, timeline
--
--   2. Field Agent PWA tables (6 tables)
--      - Used by the agent app at /agent (phone+password login, attendance,
--        content hub) AND managed from the admin dashboard's "Field Agents"
--        sidebar group
--      - agent_profiles, agent_attendance, agent_settings,
--        agent_content_posts, agent_content_brochures, agent_content_videos
--
-- Both projects point to the SAME Supabase instance via env vars:
--   NEXT_PUBLIC_SUPABASE_URL
--   NEXT_PUBLIC_SUPABASE_ANON_KEY
--   SUPABASE_SERVICE_ROLE_KEY   (server-only, for /api/* routes)
--
-- Idempotent — safe to re-run.
-- ============================================================

-- Required for bcrypt password hashing via crypt()
create extension if not exists pgcrypto;

-- ============================================================
-- 1. WEBSITE CONTENT TABLES (13 tables)
-- ============================================================

create table if not exists public.projects (
  id text primary key,
  name text not null,
  location text,
  total_area text,
  number_of_plots integer default 0,
  layout_image text,
  cover_image text,
  starting_price numeric,
  price_per_cent numeric,
  area_unit text default 'cents',
  map_lat double precision,
  map_lng double precision,
  map_zoom integer default 13,
  status text default 'active',
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.layouts (
  id text primary key,
  project_id text references public.projects(id) on delete cascade,
  name text not null,
  image text,
  description text,
  number_of_plots integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.plots (
  id text primary key,
  layout_id text references public.layouts(id) on delete cascade,
  project_id text references public.projects(id) on delete cascade,
  plot_number text not null,
  block text,
  size numeric,
  size_unit text default 'cents',
  facing text default 'East',
  price_per_cent numeric,
  total_price numeric,
  status text default 'available',
  corner_plot boolean default false,
  road_width integer default 30,
  notes text,
  x numeric default 0,
  y numeric default 0,
  width numeric default 5,
  height numeric default 5,
  customer_id text,
  booking_id text,
  sale_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.settings (
  id integer primary key default 1,
  company_name text default 'VGG Infra Developers',
  company_logo text,
  gst text,
  address text,
  phone text,
  email text,
  upi text,
  bank_name text,
  account_name text,
  account_number text,
  ifsc text,
  branch text,
  constraint singleton_settings check (id = 1)
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.hero_banners (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  subtitle text,
  image text not null,
  cta_text text,
  cta_link text,
  "order" integer default 0,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.gallery_images (
  id text primary key default gen_random_uuid()::text,
  title text,
  image text not null,
  category text,
  project_id text,
  "order" integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.amenities (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text,
  icon text,
  image text,
  "order" integer default 0
);

create table if not exists public.testimonials (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  role text,
  photo text,
  rating integer default 5,
  text text not null,
  video_url text,
  "order" integer default 0
);

create table if not exists public.faqs (
  id text primary key default gen_random_uuid()::text,
  question text not null,
  answer text not null,
  category text,
  "order" integer default 0
);

create table if not exists public.team_members (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  role text,
  photo text,
  bio text,
  phone text,
  email text,
  linkedin text,
  "order" integer default 0
);

create table if not exists public.offers (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text,
  image text,
  valid_until date,
  active boolean default true,
  "order" integer default 0
);

create table if not exists public.brochures (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  file_url text not null,
  project_id text,
  "order" integer default 0
);

create table if not exists public.news (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  content text,
  image text,
  date date not null default current_date,
  link text,
  "order" integer default 0
);

create table if not exists public.nearby_places (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  type text,
  distance_km numeric,
  travel_minutes integer,
  icon text,
  "order" integer default 0
);

create table if not exists public.videos (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  url text not null,
  thumbnail text,
  project_id text,
  "order" integer default 0
);

create table if not exists public.company_stats (
  id text primary key default gen_random_uuid()::text,
  label text not null,
  value numeric not null,
  suffix text,
  icon text,
  "order" integer default 0
);

create table if not exists public.timeline_events (
  id text primary key default gen_random_uuid()::text,
  year text not null,
  title text not null,
  description text,
  "order" integer default 0
);

-- ============================================================
-- 2. FIELD AGENT PWA TABLES (6 tables)
-- ============================================================

-- 2.1 Agent profiles (people who sign in at /agent)
create table if not exists public.agent_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  employee_code text,
  designation text,
  department text,
  avatar_url text,
  reporting_manager text,
  joined_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_agent_profiles_phone_active
  on public.agent_profiles (phone)
  where phone is not null and active = true;

-- 2.2 Attendance records (photo check-ins/outs)
create table if not exists public.agent_attendance (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_profiles(id) on delete cascade,
  type text not null check (type in ('check_in','check_out')),
  captured_at timestamptz not null default now(),
  photo_url text,
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  status text not null default 'present' check (status in ('present','warned','flagged')),
  distance_meters double precision,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_agent_attendance_agent_time
  on public.agent_attendance (agent_id, captured_at desc);

-- 2.3 Agent app settings (singleton, id=1)
-- Branding (app_name + logo_url) + geofence config.
create table if not exists public.agent_settings (
  id smallint primary key default 1,
  office_lat double precision,
  office_lng double precision,
  geofence_enabled boolean not null default false,
  geofence_radius_meters integer,
  app_name text not null default 'Agent',
  tagline text,
  logo_url text,
  updated_at timestamptz not null default now(),
  constraint singleton_agent_settings check (id = 1)
);
insert into public.agent_settings (id, geofence_enabled, app_name)
values (1, false, 'Agent')
on conflict (id) do nothing;

-- 2.4 Content: posts (articles / announcements)
create table if not exists public.agent_content_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  cover_image_url text,
  attachment_url text,
  published_at timestamptz,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.5 Content: brochures (PDFs)
create table if not exists public.agent_content_brochures (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_image_url text,
  file_url text,
  file_size_bytes bigint,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.6 Content: videos (training / promos)
create table if not exists public.agent_content_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  thumbnail_url text,
  video_url text,
  duration_seconds integer,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 3. STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public)
values ('agent-attendance-photos', 'agent-attendance-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('agent-branding', 'agent-branding', true)
on conflict (id) do nothing;

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================
alter table public.agent_profiles enable row level security;
alter table public.agent_attendance enable row level security;
alter table public.agent_content_posts enable row level security;
alter table public.agent_content_brochures enable row level security;
alter table public.agent_content_videos enable row level security;
alter table public.agent_settings enable row level security;

-- agent_profiles: agents can read their own row
drop policy if exists "agents select own profile" on public.agent_profiles;
create policy "agents select own profile" on public.agent_profiles
  for select using (auth.uid() = auth_user_id);

-- agent_attendance: agents can read their own rows, insert their own rows
drop policy if exists "agents select own attendance" on public.agent_attendance;
create policy "agents select own attendance" on public.agent_attendance
  for select using (
    agent_id in (select id from public.agent_profiles where auth_user_id = auth.uid())
  );
drop policy if exists "agents insert own attendance" on public.agent_attendance;
create policy "agents insert own attendance" on public.agent_attendance
  for insert with check (
    agent_id in (select id from public.agent_profiles where auth_user_id = auth.uid())
  );

-- Content: any authenticated agent can read published rows
drop policy if exists "agents read posts" on public.agent_content_posts;
create policy "agents read posts" on public.agent_content_posts
  for select using (auth.role() = 'authenticated' and published_at is not null);
drop policy if exists "agents read brochures" on public.agent_content_brochures;
create policy "agents read brochures" on public.agent_content_brochures
  for select using (auth.role() = 'authenticated' and published_at is not null);
drop policy if exists "agents read videos" on public.agent_content_videos;
create policy "agents read videos" on public.agent_content_videos
  for select using (auth.role() = 'authenticated' and published_at is not null);

-- agent_settings: NO SELECT policy for agents. Branding is exposed via a
-- custom RPC that returns only public fields. Geofence config stays hidden.
drop policy if exists "agents read settings" on public.agent_settings;
-- (intentionally no policy)

-- ============================================================
-- 5. PUBLIC FUNCTION: get_agent_branding()
-- Returns only the public branding fields. Geofence config never leaks.
-- ============================================================
create or replace function public.get_agent_branding()
returns table (
  app_name text,
  tagline text,
  logo_url text
)
language sql stable security definer as $$
  select app_name, tagline, logo_url
  from public.agent_settings
  where id = 1;
$$;

-- ============================================================
-- 6. STORAGE POLICY: agents upload their own attendance photos
-- ============================================================
drop policy if exists "agents upload own photos" on storage.objects;
create policy "agents upload own photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'agent-attendance-photos'
    and (storage.foldername(name))[1] = (
      select id::text from public.agent_profiles where auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- 7. TRIGGER: keep agent_profiles.email in sync with auth.users.email
-- ============================================================
create or replace function public.sync_agent_email()
returns trigger language plpgsql security definer as $$
begin
  update public.agent_profiles
     set email = new.email, updated_at = now()
   where auth_user_id = new.id;
  return new;
end; $$;

drop trigger if exists trg_sync_agent_email on auth.users;
create trigger trg_sync_agent_email
  after update of email on auth.users
  for each row execute function public.sync_agent_email();

-- Done. All 19 tables + RLS + storage + triggers are ready.
