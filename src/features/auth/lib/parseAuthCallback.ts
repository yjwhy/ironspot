import { AUTH_REDIRECT_URL } from '../constants';

export type ParsedCallback =
  | { kind: 'pkce'; code: string }
  | {
      kind: 'invalid';
      reason: 'parse_error' | 'missing_tokens' | 'implicit_flow_rejected' | 'origin_mismatch';
    };

/**
 * Security task #16 — only accept PKCE callbacks.
 *
 * Supabase's auth flow has two modes:
 *   - PKCE (Proof Key for Code Exchange): callback carries `?code=…`; the
 *     code is meaningless without the original `code_verifier` that
 *     IronSpot generated and kept in memory. Even a hijacked callback
 *     (custom-scheme collision attack) cannot be exchanged for a token.
 *   - Implicit: callback carries `#access_token=…&refresh_token=…` in the
 *     URL fragment. A hijacker who intercepts the callback gets a fully
 *     usable session immediately.
 *
 * supabase.ts pins `flowType: 'pkce'` so Supabase never emits an implicit
 * callback, but a custom-scheme hijack could in theory craft one. We
 * defence-in-depth by refusing any callback that carries hash tokens —
 * `implicit_flow_rejected` short-circuits the LoginScreen into an
 * error toast instead of `setSession`-ing whatever the URL handed us.
 */
// Security E3: parse AUTH_REDIRECT_URL once at module load so the check is
// O(1) per callback. Anything that doesn't match this protocol + host
// (currently `ironspot://auth`) is treated as a hijack attempt — even if
// it happens to carry a valid-looking `?code=…`.
const EXPECTED_PROTOCOL = new URL(AUTH_REDIRECT_URL).protocol;
const EXPECTED_HOST = new URL(AUTH_REDIRECT_URL).host;

export function parseAuthCallback(callbackUrl: string): ParsedCallback {
  let url: URL;
  try {
    url = new URL(callbackUrl);
  } catch {
    return { kind: 'invalid', reason: 'parse_error' };
  }

  // Security E3: PKCE alone makes a stolen code unusable without our
  // in-memory verifier, but the parser is the only validation point
  // between the OS deep-link handler and `supabase.exchangeCodeForSession`.
  // Reject any callback whose origin differs from AUTH_REDIRECT_URL — a
  // custom-scheme collision attack from another app on the device can't
  // forge the protocol+host pair we declared in the OAuth request.
  if (url.protocol !== EXPECTED_PROTOCOL || url.host !== EXPECTED_HOST) {
    return { kind: 'invalid', reason: 'origin_mismatch' };
  }

  const rawHash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(rawHash);
  const queryParams = new URLSearchParams(url.search);

  const code = queryParams.get('code');
  if (code) return { kind: 'pkce', code };

  // Hash-fragment tokens are the implicit-flow shape. Refuse them outright.
  if (hashParams.get('access_token') || hashParams.get('refresh_token')) {
    return { kind: 'invalid', reason: 'implicit_flow_rejected' };
  }

  return { kind: 'invalid', reason: 'missing_tokens' };
}
