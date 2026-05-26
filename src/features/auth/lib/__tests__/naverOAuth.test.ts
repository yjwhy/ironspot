import { buildNaverAuthorizeUrl, generateOAuthState, parseNaverCallback } from '../naverOAuth';

describe('buildNaverAuthorizeUrl', () => {
  it('builds the authorize URL with response_type, client_id, redirect_uri, state', () => {
    const url = new URL(buildNaverAuthorizeUrl({ clientId: 'cid-1', state: 'st-1' }));

    expect(url.origin + url.pathname).toBe('https://nid.naver.com/oauth2.0/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('cid-1');
    expect(url.searchParams.get('redirect_uri')).toBe('ironspot://auth/naver');
    expect(url.searchParams.get('state')).toBe('st-1');
  });
});

describe('parseNaverCallback', () => {
  const STATE = 'expected-state';

  it('returns the code when origin + state match', () => {
    const result = parseNaverCallback(`ironspot://auth/naver?code=abc123&state=${STATE}`, STATE);
    expect(result).toEqual({ kind: 'code', code: 'abc123', state: STATE });
  });

  it('rejects a mismatched origin (custom-scheme collision)', () => {
    const result = parseNaverCallback(`evil://auth/naver?code=abc&state=${STATE}`, STATE);
    expect(result).toEqual({ kind: 'invalid', reason: 'origin_mismatch' });
  });

  it('rejects a state that does not match the generated one (CSRF guard)', () => {
    const result = parseNaverCallback('ironspot://auth/naver?code=abc&state=forged', STATE);
    expect(result).toEqual({ kind: 'invalid', reason: 'state_mismatch' });
  });

  it('rejects a missing state', () => {
    const result = parseNaverCallback('ironspot://auth/naver?code=abc', STATE);
    expect(result).toEqual({ kind: 'invalid', reason: 'state_mismatch' });
  });

  it('maps a Naver error param (e.g. user denied) to naver_error', () => {
    const result = parseNaverCallback(
      `ironspot://auth/naver?error=access_denied&error_description=denied&state=${STATE}`,
      STATE,
    );
    expect(result).toEqual({ kind: 'invalid', reason: 'naver_error' });
  });

  it('rejects a callback with matching state but no code', () => {
    const result = parseNaverCallback(`ironspot://auth/naver?state=${STATE}`, STATE);
    expect(result).toEqual({ kind: 'invalid', reason: 'missing_code' });
  });

  it('returns parse_error for an unparseable URL', () => {
    const result = parseNaverCallback('not a url', STATE);
    expect(result).toEqual({ kind: 'invalid', reason: 'parse_error' });
  });
});

describe('generateOAuthState', () => {
  it('returns a 32-char hex string', () => {
    expect(generateOAuthState()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('returns a different value each call', () => {
    expect(generateOAuthState()).not.toBe(generateOAuthState());
  });
});
