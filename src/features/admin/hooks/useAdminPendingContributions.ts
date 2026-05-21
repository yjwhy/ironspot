import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import { listPending } from '@/shared/generated/admin-contributions/admin-contributions';
import type { AdminPendingContribution } from '@/shared/generated/model/adminPendingContribution';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';
import { STALE_TIME_PHOTOS_MS } from '@/shared/lib/stale-times';

import { adminKeys } from '../query-keys';

const DEFAULT_LIMIT = 50;

/**
 * Phase 5 item 11 sub-task 4: list pending machine contributions awaiting
 * admin review. Backs the 대기 머신 tab in AdminQueueScreen.
 */
export function useAdminPendingContributions(
  limit: number = DEFAULT_LIMIT,
): UseQueryResult<AdminPendingContribution[]> {
  return useQuery({
    queryKey: adminKeys.pendingContributions(),
    queryFn: async () => unwrapOrvalResponse(await listPending({ limit })),
    staleTime: STALE_TIME_PHOTOS_MS,
  });
}
