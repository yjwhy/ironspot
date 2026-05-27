import { NAVER_REDIRECT_URL, NAVER_WEB_CALLBACK_URL } from '../constants';

// Naver's OAuth 2.0 authorization endpoint. The token exchange happens
// server-side (NaverOAuthClient) — the app only opens this authorize URL and
// captures the returned code.
const NAVER_AUTHORIZE_URL = 'https://nid.naver.com/oauth2.0/authorize';

const EXPECTED_PROTOCOL = new URL(NAVER_REDIRECT_URL).protocol;
const EXPECTED_HOST = new URL(NAVER_REDIRECT_URL).host;

export type ParsedNaverCallback =
  | { kind: 'code'; code: string; state: string }
  | {
      kind: 'invalid';
      reason: 'parse_error' | 'origin_mismatch' | 'state_mismatch' | 'missing_code' | 'naver_error';
    };

/**
 * Cryptographically random anti-CSRF state. Reuses the Web Crypto API that the
 * Supabase PKCE flow already depends on at runtime, so no new dependency is
 * pulled in just for this.
 */
export function generateOAuthState(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

interface NaverAuthorizeParams {
  clientId: string;
  state: string;
}

export function buildNaverAuthorizeUrl({ clientId, state }: NaverAuthorizeParams): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    // Naver rejects custom schemes, so the redirect_uri is the https bounce
    // page; it forwards to NAVER_REDIRECT_URL, which the auth session catches.
    redirect_uri: NAVER_WEB_CALLBACK_URL,
    state,
  });
  return `${NAVER_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Parse the Naver callback deep link. Mirrors parseAuthCallback's origin check
 * (a custom-scheme collision from another app cannot forge our protocol+host)
 * and additionally requires the returned state to equal the one we generated —
 * the CSRF guard, since Naver echoes state back verbatim.
 */
export function parseNaverCallback(
  callbackUrl: string,
  expectedState: string,
): ParsedNaverCallback {
  let url: URL;
  try {
    url = new URL(callbackUrl);
  } catch {
    return { kind: 'invalid', reason: 'parse_error' };
  }

  if (url.protocol !== EXPECTED_PROTOCOL || url.host !== EXPECTED_HOST) {
    return { kind: 'invalid', reason: 'origin_mismatch' };
  }

  const params = new URLSearchParams(url.search);

  // Naver appends error/error_description when the user denies or auth fails.
  if (params.get('error')) {
    return { kind: 'invalid', reason: 'naver_error' };
  }

  const state = params.get('state');
  if (!state || state !== expectedState) {
    return { kind: 'invalid', reason: 'state_mismatch' };
  }

  const code = params.get('code');
  if (!code) {
    return { kind: 'invalid', reason: 'missing_code' };
  }

  return { kind: 'code', code, state };
}
