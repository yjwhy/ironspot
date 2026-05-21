/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment -- mocked module access patterns + `expect.objectContaining` literals trip these rules; safe within tests. */
import * as Sentry from '@sentry/react-native';
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

import {
  buildNmapUrl,
  buildWebFallbackUrl,
  type DirectionsGym,
  openDirections,
} from '../directions';

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve()),
}));

// `as unknown as jest.Mock<…>` (instead of the direct cast to
// MockedFunction<typeof X>) — the direct cast trips
// @typescript-eslint/unbound-method on the read of `Linking.canOpenURL`
// because the lint rule sees the bare property reference. The two-step
// unknown cast bypasses the rule without disabling it project-wide.
const mockedCanOpenURL = Linking.canOpenURL as unknown as jest.Mock<Promise<boolean>, [string]>;
const mockedOpenURL = Linking.openURL as unknown as jest.Mock<Promise<void>, [string]>;
const mockedAddBreadcrumb = Sentry.addBreadcrumb as unknown as jest.Mock<void, [unknown]>;
const mockedOpenBrowserAsync = WebBrowser.openBrowserAsync as unknown as jest.Mock<
  Promise<unknown>,
  [string]
>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedCanOpenURL.mockResolvedValue(true);
  mockedOpenURL.mockResolvedValue(undefined);
});

const gymWithPlaceId: DirectionsGym = {
  id: 'gym-1',
  name: '에어짐 강남',
  latitude: 37.4979,
  longitude: 127.0276,
  naverPlaceId: 'naver-12345',
};

const gymWithoutPlaceId: DirectionsGym = {
  id: 'gym-2',
  name: '강남 헬스장',
  latitude: 37.499,
  longitude: 127.028,
  naverPlaceId: null,
};

describe('buildNmapUrl', () => {
  it('prefers nmap://place when naverPlaceId is present', () => {
    expect(buildNmapUrl({ gym: gymWithPlaceId })).toBe(
      'nmap://place?id=naver-12345&appname=com.ironspot.app',
    );
  });

  it('encodes the place id for URL safety', () => {
    expect(buildNmapUrl({ gym: { ...gymWithPlaceId, naverPlaceId: 'a b+c' } })).toContain(
      'a%20b%2Bc',
    );
  });

  it('falls back to nmap://route/public when naverPlaceId is null', () => {
    const url = buildNmapUrl({ gym: gymWithoutPlaceId });
    expect(url).toMatch(/^nmap:\/\/route\/public\?/);
    expect(url).toContain('dlat=37.499');
    expect(url).toContain('dlng=127.028');
    expect(url).toContain('dname=');
    expect(url).toContain('appname=com.ironspot.app');
  });

  it('includes origin slat/slng when an origin is supplied', () => {
    const url = buildNmapUrl({
      gym: gymWithoutPlaceId,
      origin: { latitude: 37.5, longitude: 127.03 },
    });
    expect(url).toContain('slat=37.5');
    expect(url).toContain('slng=127.03');
  });

  it('treats empty naverPlaceId string as no id (defensive)', () => {
    expect(buildNmapUrl({ gym: { ...gymWithPlaceId, naverPlaceId: '' } })).toMatch(
      /^nmap:\/\/route\/public\?/,
    );
  });
});

describe('buildWebFallbackUrl', () => {
  it('encodes the gym name for the search query', () => {
    expect(buildWebFallbackUrl(gymWithPlaceId)).toBe(
      'https://map.naver.com/v5/search/%EC%97%90%EC%96%B4%EC%A7%90%20%EA%B0%95%EB%82%A8',
    );
  });
});

describe('openDirections', () => {
  it('opens the nmap place deeplink when Naver Maps is installed and place id exists', async () => {
    await openDirections({ gym: gymWithPlaceId, source: 'card' });
    expect(mockedOpenURL).toHaveBeenCalledWith(
      'nmap://place?id=naver-12345&appname=com.ironspot.app',
    );
    expect(mockedOpenBrowserAsync).not.toHaveBeenCalled();
  });

  it('drops a Sentry breadcrumb with source + branch on the nmap path', async () => {
    await openDirections({ gym: gymWithPlaceId, source: 'detail' });
    expect(mockedAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'directions',
        data: expect.objectContaining({ gymId: 'gym-1', source: 'detail', branch: 'place' }),
      }),
    );
  });

  it('falls back to the web browser when Naver Maps is not installed', async () => {
    mockedCanOpenURL.mockResolvedValue(false);
    await openDirections({ gym: gymWithPlaceId, source: 'card' });
    expect(mockedOpenBrowserAsync).toHaveBeenCalledWith(buildWebFallbackUrl(gymWithPlaceId));
    expect(mockedOpenURL).not.toHaveBeenCalled();
  });

  it('drops a "web-fallback" breadcrumb when Naver Maps is missing', async () => {
    mockedCanOpenURL.mockResolvedValue(false);
    await openDirections({ gym: gymWithPlaceId, source: 'card' });
    expect(mockedAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'directions',
        message: 'web-fallback',
        data: expect.objectContaining({ source: 'card' }),
      }),
    );
  });

  it('treats canOpenURL rejection as "Naver Maps absent" (no throw, web fallback)', async () => {
    mockedCanOpenURL.mockRejectedValue(new Error('platform check failed'));
    await expect(openDirections({ gym: gymWithPlaceId, source: 'card' })).resolves.toBeUndefined();
    expect(mockedOpenBrowserAsync).toHaveBeenCalled();
  });

  it('uses the route deeplink branch in the breadcrumb data when no place id', async () => {
    await openDirections({ gym: gymWithoutPlaceId, source: 'card' });
    expect(mockedAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'directions',
        data: expect.objectContaining({ branch: 'route' }),
      }),
    );
  });
});
