import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import { useAuthenticatedUserId } from '@/features/auth/hooks/useAuthenticatedUserId';
import type { PhotoResponse } from '@/shared/generated/model/photoResponse';
import { getMyPhotos } from '@/shared/generated/users/users';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';

import { profileKeys } from '../query-keys';

export function useMyPhotos(): UseQueryResult<PhotoResponse[]> {
  const userId = useAuthenticatedUserId();

  return useQuery({
    queryKey: profileKeys.myPhotos(userId),
    queryFn: async () => unwrapOrvalResponse(await getMyPhotos()),
    enabled: userId !== null,
  });
}
