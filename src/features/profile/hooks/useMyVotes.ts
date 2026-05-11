import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import { useAuthenticatedUserId } from '@/features/auth/hooks/useAuthenticatedUserId';
import type { PhotoResponse } from '@/shared/generated/model/photoResponse';
import { getMyVotes } from '@/shared/generated/users/users';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';

import { profileKeys } from '../query-keys';

export function useMyVotes(): UseQueryResult<PhotoResponse[]> {
  const userId = useAuthenticatedUserId();

  return useQuery({
    queryKey: profileKeys.myVotes(userId),
    queryFn: async () => unwrapOrvalResponse(await getMyVotes()),
    enabled: userId !== null,
  });
}
