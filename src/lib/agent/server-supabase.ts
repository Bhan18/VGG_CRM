// Server-side Supabase admin client. Uses the service-role key from env.
// Falls back to null if env is missing — the API routes handle that case
// by returning a clear error to the agent.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;
let tried = false;

export function getServerSupabase(): SupabaseClient | null {
  if (tried) return cached;
  tried = true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    return null;
  }
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * Resolve the agent profile from the bearer token in the request.
 * Returns null if the token is missing, expired, or not linked to a profile.
 */
export async function resolveAgentFromRequest(req: Request): Promise<
  | { ok: true; agentId: string; authUserId: string; profile: Record<string, unknown> }
  | { ok: false; reason: string; status: number }
> {
  const sb = getServerSupabase();
  if (!sb) {
    return { ok: false, reason: "Service is not configured.", status: 503 };
  }
  // Try Authorization header first, then cookie.
  const authHeader = req.headers.get("authorization") || "";
  let token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    const cookie = req.headers.get("cookie") || "";
    const m = cookie.match(/(?:^|;\s*)agent-session-v1=([^;]+)/);
    if (m) {
      try {
        const decoded = JSON.parse(decodeURIComponent(m[1]));
        token = decoded?.token || "";
      } catch {
        /* ignore */
      }
    }
  }
  if (!token) {
    return { ok: false, reason: "Authentication required.", status: 401 };
  }
  const { data: userData, error: uErr } = await sb.auth.getUser(token);
  if (uErr || !userData?.user) {
    return { ok: false, reason: "Session expired. Please sign in again.", status: 401 };
  }
  const authUserId = userData.user.id;
  const { data: profileRow, error: pErr } = await sb
    .from("agent_profiles")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (pErr || !profileRow) {
    return { ok: false, reason: "Profile not found.", status: 403 };
  }
  if (profileRow.active === false) {
    return { ok: false, reason: "Account deactivated.", status: 403 };
  }
  return { ok: true, agentId: profileRow.id, authUserId, profile: profileRow };
}
