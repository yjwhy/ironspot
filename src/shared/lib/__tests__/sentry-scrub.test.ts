import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';

import {
  maskEmail,
  scrubBreadcrumb,
  scrubErrorEvent,
  scrubHeaders,
  scrubUrl,
} from '../sentry-scrub';

describe('scrubUrl', () => {
  it('redacts token in query string', () => {
    expect(scrubUrl('https://api.example/foo?token=abc.def')).toBe(
      'https://api.example/foo?token=%5BFiltered%5D',
    );
  });

  it('redacts multiple sensitive keys', () => {
    expect(scrubUrl('https://api.example/cb?code=XYZ&access_token=abc&utm=ok')).toBe(
      'https://api.example/cb?code=%5BFiltered%5D&access_token=%5BFiltered%5D&utm=ok',
    );
  });

  it('keeps URLs without sensitive keys unchanged', () => {
    expect(scrubUrl('https://api.example/foo?utm=ok')).toBe('https://api.example/foo?utm=ok');
  });

  it('preserves relative URL shape', () => {
    expect(scrubUrl('/auth/callback?code=abc')).toBe('/auth/callback?code=%5BFiltered%5D');
  });

  it('returns input unchanged on parse failure', () => {
    expect(scrubUrl('')).toBe('');
  });
});

describe('scrubHeaders', () => {
  it('redacts Authorization regardless of case', () => {
    const out = scrubHeaders({ Authorization: 'Bearer abc', 'content-type': 'application/json' });
    expect(out).toEqual({ Authorization: '[Filtered]', 'content-type': 'application/json' });
  });

  it('redacts cookie + supabase auth header', () => {
    const out = scrubHeaders({ Cookie: 'sb-session=xyz', 'X-Supabase-Auth': 'eyJ...' });
    expect(out).toEqual({ Cookie: '[Filtered]', 'X-Supabase-Auth': '[Filtered]' });
  });

  it('returns non-object input unchanged', () => {
    expect(scrubHeaders(undefined)).toBe(undefined);
    expect(scrubHeaders(null)).toBe(null);
  });
});

describe('maskEmail', () => {
  it('keeps the first 2 chars of the local part', () => {
    expect(maskEmail('yongjun@generatezero.com')).toBe('yo***');
  });

  it('handles short local parts', () => {
    expect(maskEmail('a@b.com')).toBe('a***');
  });

  it('leaves non-email strings unchanged', () => {
    expect(maskEmail('not-an-email')).toBe('not-an-email');
  });
});

describe('scrubErrorEvent', () => {
  const hint = {};

  it('redacts request URL + headers + drops body', () => {
    const event = {
      request: {
        url: 'https://api.example/upload?token=abc',
        headers: { Authorization: 'Bearer abc' },
        data: 'multipart body content',
      },
    } as unknown as ErrorEvent;
    const out = scrubErrorEvent(event, hint);
    expect(out?.request?.url).toBe('https://api.example/upload?token=%5BFiltered%5D');
    expect(out?.request?.headers).toEqual({ Authorization: '[Filtered]' });
    expect(out?.request).not.toHaveProperty('data');
  });

  it('masks user email + redacts ip', () => {
    const event: ErrorEvent = {
      user: { id: 'u1', email: 'yongjun@generatezero.com', ip_address: '1.2.3.4' },
    } as ErrorEvent;
    const out = scrubErrorEvent(event, hint);
    expect(out?.user?.email).toBe('yo***');
    expect(out?.user?.ip_address).toBe('[Filtered]');
    expect(out?.user?.id).toBe('u1');
  });
});

describe('scrubBreadcrumb', () => {
  it('redacts http breadcrumb URLs', () => {
    const crumb: Breadcrumb = {
      category: 'http',
      data: { url: 'https://api.example/upload?token=abc', method: 'POST', status_code: 200 },
    };
    const out = scrubBreadcrumb(crumb);
    expect(out?.data?.url).toBe('https://api.example/upload?token=%5BFiltered%5D');
  });

  it('redacts navigation breadcrumb from/to', () => {
    const crumb: Breadcrumb = {
      category: 'navigation',
      data: { from: '/login?code=abc', to: '/home?token=xyz' },
    };
    const out = scrubBreadcrumb(crumb);
    expect(out?.data?.from).toBe('/login?code=%5BFiltered%5D');
    expect(out?.data?.to).toBe('/home?token=%5BFiltered%5D');
  });

  it('passes through console breadcrumbs unchanged', () => {
    const crumb: Breadcrumb = { category: 'console', message: 'hello' };
    expect(scrubBreadcrumb(crumb)).toBe(crumb);
  });
});
