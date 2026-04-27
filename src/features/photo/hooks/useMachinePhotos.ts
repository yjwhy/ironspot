import { useQuery } from '@tanstack/react-query';

import { photoKeys } from '../query-keys';
import { getMachinePhotos } from '../services/photo-list';

/**
 * Fetches photos for a machine ordered upvote_count desc. Disabled while
 * `gymMachineId` is empty/undefined (common during route param transitions).
 */
export function useMachinePhotos(gymMachineId: string | undefined) {
  return useQuery({
    queryKey: photoKeys.list(gymMachineId ?? ''),
    queryFn: () => {
      if (!gymMachineId) {
        throw new Error('useMachinePhotos queryFn called without gymMachineId');
      }
      return getMachinePhotos(gymMachineId);
    },
    staleTime: 1000 * 60 * 5,
    enabled: Boolean(gymMachineId),
  });
}
