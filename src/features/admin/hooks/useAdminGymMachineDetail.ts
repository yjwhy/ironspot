import { useQuery } from '@tanstack/react-query';

import { getGymMachine } from '@/shared/generated/admin/admin';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';

import { adminKeys } from '../query-keys';

/**
 * Admin gym_machine detail. ADR 0022 follow-up (Task 46) Slice 46h. Drives
 * {@link AdminGymMachineScreen} — current template + pending reports in one
 * round-trip.
 */
export function useAdminGymMachineDetail(gymMachineId: string) {
  return useQuery({
    queryKey: adminKeys.gymMachineDetail(gymMachineId),
    queryFn: async () => unwrapOrvalResponse(await getGymMachine(gymMachineId)),
    staleTime: 0,
  });
}
