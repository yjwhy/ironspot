import { parseAuthCallback } from '../parseAuthCallback';

describe('parseAuthCallback', () => {
  it('returns kind=pkce when the URL carries a code query param', () => {
    expect(parseAuthCallback('ironspot://auth/callback?code=abc123')).toEqual({
      kind: 'pkce',
      code: 'abc123',
    });
  });

  it('returns kind=implicit when the URL carries access_token + refresh_token in the hash', () => {
    expect(
      parseAuthCallback('ironspot://auth/callback#access_token=AAA&refresh_token=BBB'),
    ).toEqual({
      kind: 'implicit',
      accessToken: 'AAA',
      refreshToken: 'BBB',
    });
  });

  it('prefers PKCE when both code and hash tokens are present', () => {
    const result = parseAuthCallback(
      'ironspot://auth/callback?code=abc#access_token=AAA&refresh_token=BBB',
    );
    expect(result).toEqual({ kind: 'pkce', code: 'abc' });
  });

  it('returns kind=invalid with reason=parse_error on malformed URL', () => {
    expect(parseAuthCallback('not a url')).toEqual({
      kind: 'invalid',
      reason: 'parse_error',
    });
  });

  it('returns kind=invalid with reason=missing_tokens when URL is valid but carries no auth params', () => {
    expect(parseAuthCallback('ironspot://auth/callback?error=access_denied')).toEqual({
      kind: 'invalid',
      reason: 'missing_tokens',
    });
  });

  it('returns kind=invalid with reason=missing_tokens when only access_token is present (refresh_token missing)', () => {
    expect(parseAuthCallback('ironspot://auth/callback#access_token=AAA')).toEqual({
      kind: 'invalid',
      reason: 'missing_tokens',
    });
  });
});
