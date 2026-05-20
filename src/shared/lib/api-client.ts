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

// Orval v8's generated clients expect the mutator to return a wrapper
// `{ data, status, headers }` rather than the bare response body — the type
// alias `<endpoint>Response = { data: T, status, headers }` is generated for
// every endpoint and consumers do `response.data` to read the payload.
// Returning `.json<T>()` directly cast as `T` was a lie: at runtime every
// consumer's `response.data` was `undefined`. The bug stayed dormant because
// most flows never reached the success branch in production until Phase 5
// item 12's frontend fix made photo upload actually succeed.
//
// Accept RequestInit so Orval-generated callers (which use SecondParameter<typeof apiClient>)
// receive a compatible type. Ky accepts RequestInit-compatible objects internally.
export async function apiClient<T>(url: string, options?: RequestInit): Promise<T> {
  const sanitisedUrl = url.startsWith('/') ? url.slice(1) : url;

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const headers = new Headers(options?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const kyOptions = options as Options | undefined;

  async function executeRequest(reqHeaders: Headers): Promise<T> {
    const response = await _ky(sanitisedUrl, { ...kyOptions, headers: reqHeaders });
    const hasBody = response.status !== 204 && response.headers.get('content-length') !== '0';
    const data: unknown = hasBody ? await response.json() : undefined;
    return { data, status: response.status, headers: response.headers } as T;
  }

  try {
    return await executeRequest(headers);
  } catch (err: unknown) {
    if (err instanceof HTTPError && err.response.status === 401) {
      await supabase.auth.refreshSession();
      const { data: refreshed } = await supabase.auth.getSession();
      const newToken = refreshed.session?.access_token;
      if (!newToken) {
        throw new Error('Session expired — please log in again');
      }
      headers.set('Authorization', `Bearer ${newToken}`);
      return await executeRequest(headers);
    }
    throw err;
  }
}
