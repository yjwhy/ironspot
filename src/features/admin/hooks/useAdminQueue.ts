import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import { listPendingQueue } from '@/shared/generated/admin/admin';
import type { AdminQueueItem } from '@/shared/generated/model/adminQueueItem';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';
import { STALE_TIME_PHOTOS_MS } from '@/shared/lib/stale-times';

import { adminKeys } from '../query-keys';

/**
 * Unified admin moderation queue. ADR 0022 follow-up (Task 46) Slice 46h:
 * replaces the photo-only {@code listPendingPhotos} with the polymorphic
 * {@code listPendingQueue} endpoint (photo + gym_machine targets).
 */
export function useAdminQueue(): UseQueryResult<AdminQueueItem[]> {
  return useQuery({
    queryKey: adminKeys.pendingQueue(),
    queryFn: async () => unwrapOrvalResponse(await listPendingQueue()),
    staleTime: STALE_TIME_PHOTOS_MS,
  });
}
