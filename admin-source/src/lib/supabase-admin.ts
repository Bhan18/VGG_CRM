
// ============================================================
// Supabase Server Client (Service Role)
// Used ONLY in API routes / server-side code.
// Bypasses RLS — never import this in client components.
// ============================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Returns the Supabase admin client (service role key).
 * Lazy-initialized — only throws if env vars are missing when
 * actually called, not at import time.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase server credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment variables."
    );
  }

  _client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _client;
}

// Backward-compatible export (lazy getter)
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getSupabaseAdmin(), prop);
  },
});


