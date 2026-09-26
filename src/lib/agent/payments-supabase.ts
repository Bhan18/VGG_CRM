// Supabase client for the PAYMENTS database — the project that actually
// holds customers / payments / bookings / sales / plots.
//
// This is deliberately NOT the same client as lib/agent/server-supabase.ts.
// That one serves the attendance + website-content project, which has no
// `customers` or `payments` tables at all, so every payments query against
// it failed. Both apps (this staff app and the separate admin-dashboard)
// read and write this one project, which is what makes an approval here
// show up in the admin-dashboard immediately.
//
// Resolution order:
//   1. PAYMENTS_SUPABASE_URL + PAYMENTS_SUPABASE_SERVICE_ROLE_KEY  (preferred)
//   2. The project's own anon key, with the URL derived from its `ref`
//      claim — a stopgap so the feature works before step 1 is filled in.
//      The anon key can read AND write these tables, which is fine
//      functionally but is NOT the right long-term credential: see below.
//
// The anon fallback is a security compromise. Anyone holding the anon key
// (it is a NEXT_PUBLIC_* value, i.e. shipped to every browser) can write to
// `payments`. Put the service_role key in PAYMENTS_SUPABASE_SERVICE_ROLE_KEY
// as soon as you have it and delete the fallback.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let resolved = false;

type Resolution =
  | { ok: true; client: SupabaseClient; usingAnonFallback: boolean }
  | { ok: false; reason: string };

let result: Resolution | null = null;

/** Read the project ref out of a Supabase JWT without verifying it. */
function projectRefFromKey(key: string): string | null {
  const parts = key.split(".");
  if (parts.length < 2) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64").toString());
    return typeof claims.ref === "string" ? claims.ref : null;
  } catch {
    return null;
  }
}

function resolve(): Resolution {
  const url = process.env.PAYMENTS_SUPABASE_URL;
  const serviceKey = process.env.PAYMENTS_SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    return {
      ok: true,
      usingAnonFallback: false,
      client: createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    };
  }

  // Fallback: derive the project from the anon key we already ship.
  const anonKey =
    process.env.NEXT_PUBLIC_PAYMENTS_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const ref = anonKey ? projectRefFromKey(anonKey) : null;
  if (!anonKey || !ref) {
    return {
      ok: false,
      reason:
        "Payments database is not configured. Set PAYMENTS_SUPABASE_URL and PAYMENTS_SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  return {
    ok: true,
    usingAnonFallback: true,
    client: createClient(`https://${ref}.supabase.co`, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

export function getPaymentsSupabase(): SupabaseClient | null {
  if (resolved) return result?.ok ? result.client : null;
  resolved = true;
  result = resolve();
  if (!result.ok) {
    console.error(`[payments-supabase] ${result.reason}`);
    return null;
  }
  if (result.usingAnonFallback) {
    console.warn(
      "[payments-supabase] Using the ANON key fallback. " +
        "Set PAYMENTS_SUPABASE_URL + PAYMENTS_SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return result.client;
}

/** True when running on the anon-key fallback (used by tests/diagnostics). */
export function isUsingAnonFallback(): boolean {
  if (!resolved) resolve();
  return result?.ok ? result.usingAnonFallback : false;
}
