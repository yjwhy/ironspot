import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import { getMe } from '@/shared/generated/users/users';
import type { getMeResponse } from '@/shared/generated/users/users';

import { userKeys } from '../query-keys';
import { useAuth } from './useAuth';

export function useCurrentUser(): UseQueryResult<getMeResponse> {
  const auth = useAuth();
  const userId = auth.status === 'authenticated' ? auth.session.user.id : null;

  return useQuery({
    queryKey: userKeys.me(userId),
    queryFn: () => getMe(),
    enabled: userId !== null,
  });
}
