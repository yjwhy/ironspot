import { useQuery } from '@tanstack/react-query';

import { gymKeys } from '../query-keys';
import { getGymById } from '../services/gym-detail';

/**
 * Fetches a single gym by id. Used by Photo Gallery and Photo Detail screens to
 * render the gym name in their headers. Disabled while gymId is empty/undefined
 * (common during route param transitions).
 */
export function useGymDetail(gymId: string | undefined) {
  return useQuery({
    queryKey: gymKeys.detail(gymId ?? ''),
    queryFn: () => {
      if (!gymId) {
        throw new Error('useGymDetail queryFn called without gymId');
      }
      return getGymById(gymId);
    },
    staleTime: 1000 * 60 * 5,
    enabled: Boolean(gymId),
  });
}
