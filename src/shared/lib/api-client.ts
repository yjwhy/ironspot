import ky, { HTTPError, TimeoutError, type Options } from 'ky';

import { API_URL } from './api-base-url';
import { supabase } from './supabase';

// Re-export so consumers share a single ky resolution path. Importing these
// from 'ky' directly elsewhere risks `instanceof` returning false if ky is
// ever duplicated in the bundle (e.g. via a transitive dep pin).
export { HTTPError, TimeoutError };

// 15s rather than 10s gives headroom for the slowest legitimate path:
// large multipart upload (compressed image up to 2 MB) + BE Vision call
// (timeout configured at 7s in OcrService) + Storage write + DB insert.
// Cold-boot recovery is NOT handled by this timeout — Render free-tier
// boot is 50s+, so the app warms the BE eagerly at start-up via
// `useKeepBackendWarm`. If a cold-boot still slips through, the timeout
// will trip and the user retries — but the eager ping makes that the
// rare path.
const _ky = ky.create({
  prefixUrl: API_URL,
  timeout: 15_000,
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
      // Guest users (no initial token) hit 401 because the endpoint
      // requires auth, not because their session expired. Re-throw the
      // original HTTPError so callers' onError handlers can detect
      // status 401 and surface the right CTA (e.g. NL Search's
      // "로그인이 필요해요" alert). Same when the refresh attempt fails:
      // throw the original 401 instead of a status-less generic Error,
      // which made every auth failure fall through to a "검색에
      // 실패했어요" toast.
      if (!token) {
        throw err;
      }
      await supabase.auth.refreshSession();
      const { data: refreshed } = await supabase.auth.getSession();
      const newToken = refreshed.session?.access_token;
      if (!newToken) {
        throw err;
      }
      headers.set('Authorization', `Bearer ${newToken}`);
      return await _ky(sanitisedUrl, { ...kyOptions, headers }).json<T>();
    }
    throw err;
  }
}
