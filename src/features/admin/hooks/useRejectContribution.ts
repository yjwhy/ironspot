import { useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';
import { Alert } from 'react-native';

import { useReject } from '@/shared/generated/admin-contributions/admin-contributions';

import { adminKeys } from '../query-keys';

const TOAST_REJECTED = '반려했어요';
const TOAST_ERROR = '반려에 실패했어요';
const ALERT_TITLE = '이 기여를 반려할까요?';
const ALERT_MESSAGE =
  '반려하면 사용자가 등록한 머신은 노출되지 않아요. 사진은 감사 기록을 위해 남아요.';
const ALERT_CONFIRM = '반려';
const ALERT_CANCEL = '취소';

interface UseRejectContributionOptions {
  onSuccess?: () => void;
}

/**
 * Phase 5 item 11 sub-task 4: wraps `useReject` with queue invalidation +
 * Korean copy + the destructive confirm Alert. Backend soft-deletes the
 * gym_machines row; the bound photo (if any) stays attached to the rejected
 * row for audit, not the public surface.
 *
 * The Alert lives inside the hook (matching {@code useBanUserAction}) so
 * the calling component only expresses intent (`confirmAndReject`) and the
 * destructive-confirm policy stays in one place.
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

  function confirmAndReject() {
    Alert.alert(ALERT_TITLE, ALERT_MESSAGE, [
      { text: ALERT_CANCEL, style: 'cancel' },
      {
        text: ALERT_CONFIRM,
        style: 'destructive',
        onPress: () => {
          mutation.mutate({ id: gymMachineId });
        },
      },
    ]);
  }

  return { confirmAndReject, isPending: mutation.isPending };
}
