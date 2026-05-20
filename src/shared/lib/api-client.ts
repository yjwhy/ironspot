import ky, { HTTPError, TimeoutError, type Options } from 'ky';

import { API_URL } from './api-base-url';
import { supabase } from './supabase';

// Re-export so consumers share a single ky resolution path. Importing these
// from 'ky' directly elsewhere risks `instanceof` returning false if ky is
// ever duplicated in the bundle (e.g. via a transitive dep pin).
export { HTTPError, TimeoutError };

const _ky = ky.create({
  prefixUrl: API_URL,
  timeout: 10_000,
});

// Accept RequestInit so Orval-generated callers (which use SecondParameter<typeof apiClient>)
// receive a compatible type. Ky accepts RequestInit-compatible objects internally.
//
// apiClient returns the bare response body at runtime, even though Orval generates
// envelope types `{ data: T, status, headers }`. Consumers reconcile the gap with
// `unwrapOrvalResponse` (identity at runtime, type cast away the envelope). Phase 5
// item 12 follow-up: photo upload was the first hook to expose this convention —
// usePhotoUpload now goes through `unwrapOrvalResponse` like every other consumer.
export async function apiClient<T>(url: string, options?: RequestInit): Promise<T> {
  const sanitisedUrl = url.startsWith('/') ? url.slice(1) : url;

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const headers = new Headers(options?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const kyOptions = options as Options | undefined;

  try {
    return await _ky(sanitisedUrl, { ...kyOptions, headers }).json<T>();
  } catch (err: unknown) {
    if (err instanceof HTTPError && err.response.status === 401) {
      await supabase.auth.refreshSession();
      const { data: refreshed } = await supabase.auth.getSession();
      const newToken = refreshed.session?.access_token;
      if (!newToken) {
        throw new Error('Session expired — please log in again');
      }
      headers.set('Authorization', `Bearer ${newToken}`);
      return await _ky(sanitisedUrl, { ...kyOptions, headers }).json<T>();
    }
    throw err;
  }
}
