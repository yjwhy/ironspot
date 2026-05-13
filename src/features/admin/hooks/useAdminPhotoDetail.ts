import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import { getPhoto } from '@/shared/generated/admin/admin';
import type { AdminPhotoDetailResponse } from '@/shared/generated/model/adminPhotoDetailResponse';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';
import { STALE_TIME_PHOTOS_MS } from '@/shared/lib/stale-times';

import { adminKeys } from '../query-keys';

export function useAdminPhotoDetail(photoId: string): UseQueryResult<AdminPhotoDetailResponse> {
  return useQuery({
    queryKey: adminKeys.photoDetail(photoId),
    queryFn: async () => unwrapOrvalResponse(await getPhoto(photoId)),
    staleTime: STALE_TIME_PHOTOS_MS,
    enabled: photoId.length > 0,
  });
}
