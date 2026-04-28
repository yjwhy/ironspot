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

const PERMISSION_DENIED_MESSAGE = '위치 권한이 거부되었습니다';

interface LocationResolution {
  readonly location: Coordinate;
  readonly error: string | null;
}

async function resolveCurrentLocation(): Promise<LocationResolution> {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return { location: GANGNAM_STATION, error: PERMISSION_DENIED_MESSAGE };
  }

  try {
    const current = await Location.getCurrentPositionAsync();
    return {
      location: {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      },
      error: null,
    };
  } catch {
    return { location: GANGNAM_STATION, error: null };
  }
}

export function useCurrentLocation() {
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(function loadOnMount() {
    const controller = new AbortController();

    async function apply() {
      const result = await resolveCurrentLocation();
      if (controller.signal.aborted) return;
      setLocation(result.location);
      setError(result.error);
    }

    void apply();

    return () => {
      controller.abort();
    };
  }, []);

  return { location, error } as const;
}
