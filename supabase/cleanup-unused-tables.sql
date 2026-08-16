-- =====================================================================
-- CLEANUP — DROP UNUSED TABLES (attendance project rllwtxooeygxurolnvgr)
-- ---------------------------------------------------------------------
-- Tables below are NOT referenced by any code in agents_app or admin_app
-- (attendance modules). They are leftovers from the old agent PWA and the
-- website/CRM schema, which live in the other Supabase project
-- (biqtwnlspyvqdnfgucpl).
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query.
-- Idempotent + safe: only drops tables that exist.
-- =====================================================================

drop table if exists public.admin_users cascade;
drop table if exists public.agent_attendance cascade;

-- Website / CRM tables (used by the other project, not this one)
drop table if exists public.projects cascade;
drop table if exists public.layouts cascade;
drop table if exists public.plots cascade;
drop table if exists public.settings cascade;
drop table if exists public.hero_banners cascade;
drop table if exists public.gallery_images cascade;
drop table if exists public.testimonials cascade;
drop table if exists public.faqs cascade;
drop table if exists public.team_members cascade;
drop table if exists public.offers cascade;
drop table if exists public.news cascade;
drop table if exists public.nearby_places cascade;
drop table if exists public.videos cascade;
drop table if exists public.company_stats cascade;

-- =====================================================================
-- Verify (should return 16 rows before, 0 after for dropped tables):
--   select tablename from pg_tables where schemaname = 'public'
--     and tablename in ('admin_users','agent_attendance','projects',
--       'layouts','plots','settings','hero_banners','gallery_images',
--       'testimonials','faqs','team_members','offers','news',
--       'nearby_places','videos','company_stats');
-- =====================================================================
