import { renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';

import { makePermission, makePosition } from '@/test/utils/factories/location-permission';

import {
  GANGNAM_STATION,
  PERMISSION_DENIED_MESSAGE,
  useCurrentLocation,
} from '../useCurrentLocation';

jest.mock('expo-location', () => ({
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const mockedRequestPermission = Location.requestForegroundPermissionsAsync as jest.MockedFunction<
  typeof Location.requestForegroundPermissionsAsync
>;
const mockedGetCurrentPosition = Location.getCurrentPositionAsync as jest.MockedFunction<
  typeof Location.getCurrentPositionAsync
>;

describe('useCurrentLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts in loading status before async resolves', () => {
    mockedRequestPermission.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useCurrentLocation());

    expect(result.current).toEqual({ status: 'loading' });
  });

  it('resolves to ready with coords when permission is granted', async () => {
    mockedRequestPermission.mockResolvedValue(makePermission(Location.PermissionStatus.GRANTED));
    mockedGetCurrentPosition.mockResolvedValue(makePosition(37.5172, 127.0473));

    const { result } = renderHook(() => useCurrentLocation());

    await waitFor(() => {
      expect(result.current).toEqual({
        status: 'ready',
        location: { latitude: 37.5172, longitude: 127.0473 },
      });
    });
  });

  it('falls back to Gangnam Station with reason=permission_denied when permission is denied', async () => {
    mockedRequestPermission.mockResolvedValue(makePermission(Location.PermissionStatus.DENIED));

    const { result } = renderHook(() => useCurrentLocation());

    await waitFor(() => {
      expect(result.current).toEqual({
        status: 'fallback',
        location: GANGNAM_STATION,
        reason: 'permission_denied',
      });
    });
    expect(mockedGetCurrentPosition).not.toHaveBeenCalled();
  });

  it('falls back to Gangnam Station with reason=gps_error when getCurrentPositionAsync rejects', async () => {
    mockedRequestPermission.mockResolvedValue(makePermission(Location.PermissionStatus.GRANTED));
    mockedGetCurrentPosition.mockRejectedValue(new Error('GPS unavailable'));

    const { result } = renderHook(() => useCurrentLocation());

    await waitFor(() => {
      expect(result.current).toEqual({
        status: 'fallback',
        location: GANGNAM_STATION,
        reason: 'gps_error',
      });
    });
  });

  it('exports GANGNAM_STATION at the expected coordinate', () => {
    expect(GANGNAM_STATION).toEqual({ latitude: 37.4979, longitude: 127.0276 });
  });

  it('exports PERMISSION_DENIED_MESSAGE for consumer-side rendering', () => {
    expect(PERMISSION_DENIED_MESSAGE).toBe('위치 권한이 거부되었습니다');
  });
});
