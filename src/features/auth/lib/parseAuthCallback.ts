export type ParsedCallback =
  | { kind: 'pkce'; code: string }
  | { kind: 'implicit'; accessToken: string; refreshToken: string }
  | { kind: 'invalid'; reason: 'parse_error' | 'missing_tokens' };

export function parseAuthCallback(callbackUrl: string): ParsedCallback {
  let url: URL;
  try {
    url = new URL(callbackUrl);
  } catch {
    return { kind: 'invalid', reason: 'parse_error' };
  }

  const rawHash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(rawHash);
  const queryParams = new URLSearchParams(url.search);

  const code = queryParams.get('code');
  if (code) return { kind: 'pkce', code };

  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  if (accessToken && refreshToken) {
    return { kind: 'implicit', accessToken, refreshToken };
  }

  return { kind: 'invalid', reason: 'missing_tokens' };
}
