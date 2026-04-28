import * as Location from 'expo-location';

export function makePermission(
  status: Location.PermissionStatus,
  overrides: Partial<Location.LocationPermissionResponse> = {},
): Location.LocationPermissionResponse {
  return {
    status,
    granted: status === Location.PermissionStatus.GRANTED,
    canAskAgain: status !== Location.PermissionStatus.DENIED,
    expires: 'never',
    ...overrides,
  };
}

export function makePosition(
  latitude: number,
  longitude: number,
  overrides: Partial<Location.LocationObject['coords']> = {},
): Location.LocationObject {
  return {
    coords: {
      latitude,
      longitude,
      altitude: null,
      accuracy: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      ...overrides,
    },
    timestamp: 1_700_000_000_000,
  };
}
