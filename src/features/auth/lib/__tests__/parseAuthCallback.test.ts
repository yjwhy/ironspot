import { parseAuthCallback } from '../parseAuthCallback';

describe('parseAuthCallback', () => {
  it('returns kind=pkce when the URL carries a code query param', () => {
    expect(parseAuthCallback('ironspot://auth/callback?code=abc123')).toEqual({
      kind: 'pkce',
      code: 'abc123',
    });
  });

  it('rejects implicit-flow callbacks (security #16: hash tokens are a hijack vector)', () => {
    expect(
      parseAuthCallback('ironspot://auth/callback#access_token=AAA&refresh_token=BBB'),
    ).toEqual({
      kind: 'invalid',
      reason: 'implicit_flow_rejected',
    });
  });

  it('prefers PKCE when both code and hash tokens are present', () => {
    const result = parseAuthCallback(
      'ironspot://auth/callback?code=abc#access_token=AAA&refresh_token=BBB',
    );
    expect(result).toEqual({ kind: 'pkce', code: 'abc' });
  });

  it('rejects partial implicit (only access_token, no refresh)', () => {
    expect(parseAuthCallback('ironspot://auth/callback#access_token=AAA')).toEqual({
      kind: 'invalid',
      reason: 'implicit_flow_rejected',
    });
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

  // Security E3: origin mismatch — even with a well-formed code, refuse
  // anything not on the protocol+host pair we declared in OAuth.
  it('rejects callbacks on a different protocol (https vs ironspot://)', () => {
    expect(parseAuthCallback('https://auth/callback?code=abc')).toEqual({
      kind: 'invalid',
      reason: 'origin_mismatch',
    });
  });

  it('rejects callbacks on a different host (ironspot://evil)', () => {
    expect(parseAuthCallback('ironspot://evil/callback?code=abc')).toEqual({
      kind: 'invalid',
      reason: 'origin_mismatch',
    });
  });

  it('rejects callbacks on the http variant of our scheme (downgrade attempt)', () => {
    expect(parseAuthCallback('http://auth/callback?code=abc')).toEqual({
      kind: 'invalid',
      reason: 'origin_mismatch',
    });
  });
});
