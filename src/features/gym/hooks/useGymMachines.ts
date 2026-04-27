import { useQuery } from '@tanstack/react-query';

import { gymKeys } from '../query-keys';
import { getGymMachines } from '../services/gym-detail';

/**
 * Fetches machines for a gym (joined with template/brand/category/photos),
 * ordered by template_id so MachineList can group consecutively. Disabled
 * while `gymId` is empty/undefined — common during route param transitions.
 */
export function useGymMachines(gymId: string | undefined) {
  return useQuery({
    queryKey: gymKeys.machines(gymId ?? ''),
    queryFn: () => {
      if (!gymId) {
        throw new Error('useGymMachines queryFn called without gymId');
      }
      return getGymMachines(gymId);
    },
    staleTime: 1000 * 60 * 5,
    enabled: Boolean(gymId),
  });
}
