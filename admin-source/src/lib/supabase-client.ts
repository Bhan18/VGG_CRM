
// ============================================================
// Supabase Browser Client
// Falls back to a proper chainable no-op client if env vars aren't set.
// ============================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _noOpClient: SupabaseClient | null = null;

/**
 * A chainable no-op that resolves to { data: null, error: null }.
 * Every method returns itself so .from().insert().eq().then() works.
 */
function createNoOpChain(): Record<string, unknown> {
  const result = { data: null, error: null };
  const chain: Record<string, unknown> = {};
  const props: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then" || prop === "catch" || prop === "finally") {
        if (prop === "then") return (resolve: (v: typeof result) => void) => { resolve(result); return Promise.resolve(result); };
        if (prop === "catch") return () => Promise.resolve(result);
        if (prop === "finally") return () => Promise.resolve(result);
      }
      // Return itself for any method call, so chaining works
      return () => chain;
    },
  };
  Object.assign(chain, new Proxy(chain, props));
  return chain;
}

function getNoOpClient(): SupabaseClient {
  if (_noOpClient) return _noOpClient;
  _noOpClient = {
    from: () => createNoOpChain(),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: { message: "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." } }),
      signOut: () => Promise.resolve({ error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      admin: {
        createUser: () => Promise.resolve({ data: { user: null }, error: { message: "No-op" } }),
        updateUserById: () => Promise.resolve({ data: { user: null }, error: null }),
      },
    },
    channel: () => ({ on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }) }),
    removeChannel: () => {},
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: null }),
        download: () => Promise.resolve({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
  } as unknown as SupabaseClient;
  return _noOpClient;
}

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return getNoOpClient();
  }

  _client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getSupabase() as object, prop);
  },
});


