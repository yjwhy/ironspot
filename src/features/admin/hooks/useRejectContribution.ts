import { useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';

import { useReject } from '@/shared/generated/admin-contributions/admin-contributions';

import { adminKeys } from '../query-keys';

const TOAST_REJECTED = '반려했어요';
const TOAST_ERROR = '반려에 실패했어요';

interface UseRejectContributionOptions {
  onSuccess?: () => void;
}

/**
 * Phase 5 item 11 sub-task 4: wraps `useReject` with queue invalidation +
 * Korean copy. Backend soft-deletes the gym_machines row; the bound photo
 * (if any) stays attached to the rejected row for audit, not the public
 * surface.
 */
export function useRejectContribution(
  gymMachineId: string,
  options?: UseRejectContributionOptions,
) {
  const queryClient = useQueryClient();

  const mutation = useReject({
    mutation: {
      onSuccess: () => {
        burnt.toast({ title: TOAST_REJECTED, preset: 'done' });
        void queryClient.invalidateQueries({
          queryKey: adminKeys.pendingContributions(),
        });
        options?.onSuccess?.();
      },
      onError: () => {
        burnt.toast({ title: TOAST_ERROR, preset: 'error' });
      },
    },
  });

  function handleReject() {
    mutation.mutate({ id: gymMachineId });
  }

  return { handleReject, isPending: mutation.isPending };
}
