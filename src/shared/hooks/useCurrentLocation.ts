import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export interface Coordinate {
  readonly latitude: number;
  readonly longitude: number;
}

export const GANGNAM_STATION: Coordinate = {
  latitude: 37.4979,
  longitude: 127.0276,
};

export const PERMISSION_DENIED_MESSAGE = '위치 권한이 거부되었습니다';

export type FallbackReason = 'permission_denied' | 'gps_error';

export type LocationState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly location: Coordinate }
  | { readonly status: 'fallback'; readonly location: Coordinate; readonly reason: FallbackReason };

type ResolvedLocationState = Exclude<LocationState, { status: 'loading' }>;

async function acquireCurrentLocation(): Promise<ResolvedLocationState> {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return { status: 'fallback', location: GANGNAM_STATION, reason: 'permission_denied' };
  }

  try {
    const current = await Location.getCurrentPositionAsync();
    return {
      status: 'ready',
      location: {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      },
    };
  } catch {
    return { status: 'fallback', location: GANGNAM_STATION, reason: 'gps_error' };
  }
}

// Skip GPS in dev builds so the app starts at a known Korean location without VPN.
// process.env.NODE_ENV check keeps tests unaffected (__DEV__ is true in Jest too).
const DEV_FORCE_LOCATION = __DEV__ && process.env.NODE_ENV !== 'test';

export function useCurrentLocation(): LocationState {
  const [state, setState] = useState<LocationState>(
    DEV_FORCE_LOCATION ? { status: 'ready', location: GANGNAM_STATION } : { status: 'loading' },
  );

  useEffect(function loadOnMount() {
    if (DEV_FORCE_LOCATION) return;

    const controller = new AbortController();

    async function apply() {
      const result = await acquireCurrentLocation();
      if (controller.signal.aborted) return;
      setState(result);
    }

    void apply();

    return () => {
      controller.abort();
    };
  }, []);

  return state;
}
