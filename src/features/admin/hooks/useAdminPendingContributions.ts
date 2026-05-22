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

interface SingleContributionResult {
  contribution: AdminPendingContribution | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Phase 5 item 11 sub-task 4: detail-screen hook that derives a single
 * contribution by id from the list query's cache. There is no dedicated
 * GET /api/admin/contributions/{id} endpoint — the list page is small
 * enough that fetching the whole array and finding the row by id is the
 * cheapest path. {@code contribution === undefined} after load completes
 * means "not in the current pending set" (already promoted / rejected /
 * unknown id), not "still loading".
 */
export function useAdminPendingContributionItem(gymMachineId: string): SingleContributionResult {
  const list = useAdminPendingContributions();
  return {
    contribution: list.data?.find((row) => row.gymMachineId === gymMachineId),
    isLoading: list.isLoading,
    isError: list.isError,
  };
}
