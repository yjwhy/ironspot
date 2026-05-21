import { useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';

import { usePromote } from '@/shared/generated/admin-contributions/admin-contributions';
import type { PromoteContributionRequest } from '@/shared/generated/model/promoteContributionRequest';

import { adminKeys } from '../query-keys';

const TOAST_PROMOTED = '머신을 승격했어요';
const TOAST_MERGED = '기존 머신과 합쳤어요';
const TOAST_ERROR = '승격에 실패했어요';

interface UsePromoteContributionOptions {
  onSuccess?: () => void;
}

/**
 * Phase 5 item 11 sub-task 4: wraps the generated `usePromote` mutation with
 * invalidation (queue tab counts + contribution detail) and Korean copy.
 * Toast text distinguishes the merge branch (`mergedIntoGymMachineId !==
 * null`) from a clean promote.
 */
export function usePromoteContribution(
  gymMachineId: string,
  options?: UsePromoteContributionOptions,
) {
  const queryClient = useQueryClient();

  const mutation = usePromote({
    mutation: {
      onSuccess: (response) => {
        const merged = response.data.mergedIntoGymMachineId !== undefined;
        burnt.toast({
          title: merged ? TOAST_MERGED : TOAST_PROMOTED,
          preset: 'done',
        });
        void queryClient.invalidateQueries({
          queryKey: adminKeys.pendingContributions(),
        });
        void queryClient.invalidateQueries({
          queryKey: adminKeys.gymMachineDetail(gymMachineId),
        });
        options?.onSuccess?.();
      },
      onError: () => {
        burnt.toast({ title: TOAST_ERROR, preset: 'error' });
      },
    },
  });

  function handlePromote(data: PromoteContributionRequest) {
    mutation.mutate({ id: gymMachineId, data });
  }

  return { handlePromote, isPending: mutation.isPending };
}
