import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import { listPendingPhotos } from '@/shared/generated/admin/admin';
import type { AdminQueuePhotoSummary } from '@/shared/generated/model/adminQueuePhotoSummary';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';
import { STALE_TIME_PHOTOS_MS } from '@/shared/lib/stale-times';

import { adminKeys } from '../query-keys';

export function useAdminQueue(): UseQueryResult<AdminQueuePhotoSummary[]> {
  return useQuery({
    queryKey: adminKeys.pendingPhotos(),
    queryFn: async () => unwrapOrvalResponse(await listPendingPhotos({ status: 'pending_review' })),
    staleTime: STALE_TIME_PHOTOS_MS,
  });
}
