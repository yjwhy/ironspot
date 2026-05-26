import ky, { HTTPError, TimeoutError, type Options } from 'ky';

import { API_URL } from './api-base-url';
import { supabase } from './supabase';

// Re-export so consumers share a single ky resolution path. Importing these
// from 'ky' directly elsewhere risks `instanceof` returning false if ky is
// ever duplicated in the bundle (e.g. via a transitive dep pin).
export { HTTPError, TimeoutError };

// 30s covers the slowest legitimate path on a freshly-booted Render
// container: large multipart upload (compressed image up to 2 MB) +
// first-ever Vision call on a cold WebClient pool (up to ~15s for
// Netty native lib load + TLS handshake + reactor warm-up; tuned via
// OcrService's `VISION_TIMEOUT_SECONDS` env, default 20s) + Storage
// write + DB insert + response serialisation.
//
// Cold-BE recovery (Render free-tier 50s+ boot) is NOT what this
// timeout handles — `useKeepBackendWarm` warms the BE eagerly at app
// launch. This timeout handles the cold-Vision-pool case verified on
// photo da0fd491 (2026-05-23 retry): BE was warm but the first Vision
// call still hit the 7s timeout that previously matched the 10s ky
// timeout. Subsequent calls reuse the warm pool and finish in 1-3s,
// so the generous 30s never trips on the happy path.
// ky 2.x renamed `prefixUrl` to `prefix`; behaviour is the same for our
// configuration (single base URL, no leading-slash inputs).
const _ky = ky.create({
  prefix: API_URL,
  timeout: 30_000,
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
    return await parseResponse<T>(_ky(sanitisedUrl, { ...kyOptions, headers }));
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
      // Security F6: single retry with 1s backoff. supabase.auth.refreshSession
      // can fail with a transient network error (intermittent DNS, flaky
      // Wi-Fi captive portal) — without this retry the user gets
      // hard-logged-out for a transport blip. One retry is enough for the
      // common flake; a longer ladder would mask real "refresh token
      // revoked" outcomes where the auth server returns 4xx (which doesn't
      // throw, so it never reaches this catch — only transport failures
      // do).
      await refreshSessionWithRetry();
      const { data: refreshed } = await supabase.auth.getSession();
      const newToken = refreshed.session?.access_token;
      if (!newToken) {
        throw err;
      }
      headers.set('Authorization', `Bearer ${newToken}`);
      return await parseResponse<T>(_ky(sanitisedUrl, { ...kyOptions, headers }));
    }
    throw err;
  }
}

// ky 2.x's `.json()` shortcut throws on 204 / empty bodies instead of
// returning an empty string (ky 1.x behaviour). Every DELETE endpoint in
// the BE returns 204 — `.json<void>()` from a generated Orval caller
// would now throw instead of resolving to undefined. Use the underlying
// Response and short-circuit on 204 / empty content-length to preserve
// the pre-2.x contract for void-returning operations.
// Security F6: small wrapper around supabase.auth.refreshSession with a
// single 1s-backoff retry. The Supabase auth-js SDK throws on transport
// failures (fetch reject) but resolves with `{ error }` on application
// failures like "refresh token revoked" — only the transport path is
// retried here; an explicit auth-server "no" still surfaces as a single
// failure so the caller can sign the user out.
async function refreshSessionWithRetry(): Promise<void> {
  try {
    await supabase.auth.refreshSession();
    return;
  } catch (firstAttemptError) {
    if (__DEV__) {
      console.warn(
        '[api-client] refreshSession first attempt failed, retrying in 1s',
        firstAttemptError,
      );
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    await supabase.auth.refreshSession();
  }
}

async function parseResponse<T>(promise: Promise<Response>): Promise<T> {
  const response = await promise;
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return (await response.json()) as T;
}
