// Orval generates { data: T, status: N, headers: H } envelope types, but apiClient
// returns the raw body directly. This helper unwraps the envelope at the type level
// while remaining a transparent identity function at runtime.
export function unwrapOrvalResponse<T>(response: { data: T }): T {
  return response as unknown as T;
}
