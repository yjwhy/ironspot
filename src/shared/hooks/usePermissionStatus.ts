import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

export type LocationPermissionStatus = Location.PermissionStatus;

export function usePermissionStatus() {
  const [status, setStatus] = useState<LocationPermissionStatus | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const isAborted = () => controller.signal.aborted;

    async function load() {
      const response = await Location.getForegroundPermissionsAsync();
      if (isAborted()) return;
      setStatus(response.status);
    }

    void load();

    return () => {
      controller.abort();
    };
  }, []);

  const request = useCallback(async (): Promise<LocationPermissionStatus> => {
    const response = await Location.requestForegroundPermissionsAsync();
    setStatus(response.status);
    return response.status;
  }, []);

  return { status, request } as const;
}
