/**
 * Supabase query result unwrapping helpers.
 *
 * Supabase returns `{ data, error }` instead of throwing. These helpers
 * convert errors to thrown exceptions so the rest of the service layer
 * can use normal try/catch flow.
 */

type SupabaseResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

/**
 * Unwrap a Supabase query that must return exactly one row.
 * Throws if there's an error. Returns null if no row found.
 */
export async function unwrapNullable<T>(
  promise: Promise<SupabaseResult<T>>,
): Promise<T | null> {
  const { data, error } = await promise;
  if (error) {
    // PGRST116 = no rows found with .single()
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return data;
}

/**
 * Unwrap a Supabase query that must return exactly one row.
 * Throws if there's an error OR if no row is found.
 */
export async function unwrapSingle<T>(
  promise: Promise<SupabaseResult<T>>,
): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    throw new Error(error.message);
  }
  if (data === null) {
    throw new Error("Record not found");
  }
  return data;
}

/**
 * Unwrap a Supabase query that returns an array.
 * Throws if there's an error. Returns empty array if no rows.
 */
export async function unwrapMany<T>(
  promise: Promise<SupabaseResult<T[]>>,
): Promise<T[]> {
  const { data, error } = await promise;
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

/**
 * Unwrap a Supabase mutation (insert/update/delete/upsert).
 * Returns the mutated row(s). Throws on error.
 */
export async function unwrapMutation<T>(
  promise: Promise<SupabaseResult<T>>,
): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    throw new Error(error.message);
  }
  if (data === null) {
    throw new Error("Mutation returned no data");
  }
  return data;
}
