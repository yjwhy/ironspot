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

export function useCurrentLocation() {
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const isAborted = () => controller.signal.aborted;

    async function load() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (isAborted()) return;

      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setError(PERMISSION_DENIED_MESSAGE);
        setLocation(GANGNAM_STATION);
        return;
      }

      try {
        const current = await Location.getCurrentPositionAsync();
        if (isAborted()) return;
        setLocation({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
      } catch {
        if (isAborted()) return;
        setLocation(GANGNAM_STATION);
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, []);

  return { location, error } as const;
}
