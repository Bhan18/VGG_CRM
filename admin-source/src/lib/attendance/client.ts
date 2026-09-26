/**
 * ATTENDANCE MODULE — SUPABASE CLIENT
 * =====================================================================
 * This is the SINGLE entry point for the attendance Supabase project.
 *
 * It exports two clients:
 *   - attendanceBrowser  (anon key, RLS-enforced) — safe for client-side
 *   - attendanceAdmin    (service-role key, bypasses RLS) — SERVER ONLY
 *
 * ENVIRONMENT VARIABLES (set in .env.local):
 *   NEXT_PUBLIC_ATTENDANCE_SUPABASE_URL
 *   NEXT_PUBLIC_ATTENDANCE_SUPABASE_ANON_KEY
 *   ATTENDANCE_SUPABASE_SERVICE_ROLE_KEY  (server only — never expose)
 *
 * If the env vars are not set, a clear error is thrown on first use.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_ATTENDANCE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_ATTENDANCE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.ATTENDANCE_SUPABASE_SERVICE_ROLE_KEY;

const MISSING_ENV_ERROR = `
┌─────────────────────────────────────────────────────────────────────┐
│  ATTENDANCE SUPABASE — ENVIRONMENT VARIABLES NOT CONFIGURED        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  The attendance module requires a SEPARATE Supabase project.       │
│  Create one at https://supabase.com and add these to .env.local:   │
│                                                                     │
│    NEXT_PUBLIC_ATTENDANCE_SUPABASE_URL=https://xxx.supabase.co      │
│    NEXT_PUBLIC_ATTENDANCE_SUPABASE_ANON_KEY=eyJ...                  │
│    ATTENDANCE_SUPABASE_SERVICE_ROLE_KEY=eyJ...                     │
│                                                                     │
│  Then run the SQL schema:                                           │
│    supabase/schema.sql  (in Supabase SQL editor)                    │
│    supabase/seed.sql    (optional demo data)                        │
│                                                                     │
│  See ATTENDANCE.md for full setup instructions.                     │
└─────────────────────────────────────────────────────────────────────┘
`.trim();

function createBrowserClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(MISSING_ENV_ERROR);
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

function createAdminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(MISSING_ENV_ERROR);
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Browser-safe client (anon key, RLS-enforced).
 * Use this in client components and staff self-service API routes.
 *
 * IMPORTANT: This client is subject to RLS policies. Staff can only
 * read their own records; public can read settings + active locations.
 */
let _browserClient: SupabaseClient | null = null;
export function getAttendanceBrowserClient(): SupabaseClient {
  if (!_browserClient) _browserClient = createBrowserClient();
  return _browserClient;
}

/**
 * Server-only admin client (service-role key, bypasses RLS).
 *
 * ⚠️ NEVER import this in a client component. The service-role key
 * bypasses all RLS and must never be exposed to the browser.
 *
 * Use this in:
 *   - API routes that perform admin mutations (create/update/delete)
 *   - Photo upload (writes to private storage bucket)
 *   - Audit log writes
 *   - Reading other employees' photos for admin detail views
 */
let _adminClient: SupabaseClient | null = null;
export function getAttendanceAdminClient(): SupabaseClient {
  if (!_adminClient) _adminClient = createAdminClient();
  return _adminClient;
}

/**
 * Check if Supabase is configured (for diagnostic script).
 */
export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Sentinel admin identifier used when an admin action is performed
 * without an explicit authenticated session (sandbox mode). In
 * production this comes from the existing dashboard's auth context,
 * bridged via server-side session validation.
 */
export const SANDBOX_ADMIN_ID = "admin@local";

export type AdminContext = {
  adminUserIdentifier: string;
};
