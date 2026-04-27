import { useQuery } from '@tanstack/react-query';

import { gymKeys } from '../query-keys';
import { getGymMachines } from '../services/gym-detail';

export function useGymMachines(gymId: string) {
  return useQuery({
    queryKey: gymKeys.machines(gymId),
    queryFn: () => getGymMachines(gymId),
    staleTime: 1000 * 60 * 5,
    enabled: gymId.length > 0,
  });
}
