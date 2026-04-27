export interface SupabaseListResponse<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export interface SupabaseSingleResponse<T> {
  data: T | null;
  error: { message: string } | null;
}

/**
 * Unwrap a supabase list query response into a non-null array.
 * Throws when supabase returned an error. Returns [] when data is null.
 *
 * `response` is typed as `unknown` because the supabase-js client returns its
 * own deeply-inferred result type. Callers bind `T` explicitly at the call site
 * (e.g. `unwrapList<Brand>(...)`).
 */
export function unwrapList<T>(response: unknown): T[] {
  const { data, error } = response as SupabaseListResponse<T>;
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}

/**
 * Unwrap a supabase single-row query response.
 * Throws when supabase returned an error. Returns null when data is null.
 *
 * `response` is typed as `unknown` because the supabase-js client returns its
 * own deeply-inferred result type. Callers bind `T` explicitly at the call site
 * (e.g. `unwrapSingle<Gym>(...)`).
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function unwrapSingle<T>(response: unknown): T | null {
  const { data, error } = response as SupabaseSingleResponse<T>;
  if (error) {
    throw new Error(error.message);
  }
  return data;
}
