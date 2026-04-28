import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export type LocationPermissionStatus = Location.PermissionStatus;

export function usePermissionStatus() {
  const [status, setStatus] = useState<LocationPermissionStatus | null>(null);

  useEffect(function readPermissionOnMount() {
    const controller = new AbortController();

    async function apply() {
      const response = await Location.getForegroundPermissionsAsync();
      if (controller.signal.aborted) return;
      setStatus(response.status);
    }

    void apply();

    return () => {
      controller.abort();
    };
  }, []);

  async function request(): Promise<LocationPermissionStatus> {
    const response = await Location.requestForegroundPermissionsAsync();
    setStatus(response.status);
    return response.status;
  }

  return { status, request } as const;
}
