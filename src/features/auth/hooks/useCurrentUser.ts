import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import type { UserResponse } from '@/shared/generated/model/userResponse';
import { getMe } from '@/shared/generated/users/users';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';

import { userKeys } from '../query-keys';
import { useAuthenticatedUserId } from './useAuthenticatedUserId';

export function useCurrentUser(): UseQueryResult<UserResponse> {
  const userId = useAuthenticatedUserId();

  return useQuery({
    queryKey: userKeys.me(userId),
    queryFn: async () => unwrapOrvalResponse(await getMe()),
    enabled: userId !== null,
  });
}
