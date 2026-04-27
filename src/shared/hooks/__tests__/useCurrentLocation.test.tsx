import { renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';

import { GANGNAM_STATION, useCurrentLocation } from '../useCurrentLocation';

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

function makePermission(status: Location.PermissionStatus): Location.LocationPermissionResponse {
  return {
    status,
    granted: status === Location.PermissionStatus.GRANTED,
    canAskAgain: status !== Location.PermissionStatus.DENIED,
    expires: 'never',
  };
}

function makePosition(latitude: number, longitude: number): Location.LocationObject {
  return {
    coords: {
      latitude,
      longitude,
      altitude: null,
      accuracy: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: 1_700_000_000_000,
  };
}

describe('useCurrentLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts with location=null and error=null before async resolves', () => {
    mockedRequestPermission.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useCurrentLocation());

    expect(result.current.location).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns coords from getCurrentPositionAsync when permission is granted', async () => {
    mockedRequestPermission.mockResolvedValue(makePermission(Location.PermissionStatus.GRANTED));
    mockedGetCurrentPosition.mockResolvedValue(makePosition(37.5172, 127.0473));

    const { result } = renderHook(() => useCurrentLocation());

    await waitFor(() => {
      expect(result.current.location).toEqual({ latitude: 37.5172, longitude: 127.0473 });
    });
    expect(result.current.error).toBeNull();
  });

  it('falls back to Gangnam Station with a Korean error message when permission is denied', async () => {
    mockedRequestPermission.mockResolvedValue(makePermission(Location.PermissionStatus.DENIED));

    const { result } = renderHook(() => useCurrentLocation());

    await waitFor(() => {
      expect(result.current.location).toEqual(GANGNAM_STATION);
    });
    expect(result.current.error).toBe('위치 권한이 거부되었습니다');
    expect(mockedGetCurrentPosition).not.toHaveBeenCalled();
  });

  it('falls back to Gangnam Station silently when getCurrentPositionAsync rejects', async () => {
    mockedRequestPermission.mockResolvedValue(makePermission(Location.PermissionStatus.GRANTED));
    mockedGetCurrentPosition.mockRejectedValue(new Error('GPS unavailable'));

    const { result } = renderHook(() => useCurrentLocation());

    await waitFor(() => {
      expect(result.current.location).toEqual(GANGNAM_STATION);
    });
    expect(result.current.error).toBeNull();
  });

  it('exports GANGNAM_STATION at the expected coordinate', () => {
    expect(GANGNAM_STATION).toEqual({ latitude: 37.4979, longitude: 127.0276 });
  });
});
