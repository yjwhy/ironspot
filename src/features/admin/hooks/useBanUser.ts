import { useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';
import { Alert } from 'react-native';

import { useBanUser as useBanUserMutation } from '@/shared/generated/admin/admin';

import { adminKeys } from '../query-keys';

const TOAST_BANNED = '차단됨';
const TOAST_ERROR = '사용자 차단에 실패했어요';
const ALERT_TITLE = '업로더를 차단할까요?';
const ALERT_MESSAGE = '차단된 사용자는 더 이상 로그인할 수 없습니다.';
const ALERT_CONFIRM = '차단';
const ALERT_CANCEL = '취소';

interface UseBanUserOptions {
  onSuccess?: () => void;
}

export function useBanUserAction(
  userId: string,
  photoId: string | null,
  options?: UseBanUserOptions,
) {
  const queryClient = useQueryClient();

  const mutation = useBanUserMutation({
    mutation: {
      onSuccess: () => {
        burnt.toast({ title: TOAST_BANNED, preset: 'done' });
        void queryClient.invalidateQueries({ queryKey: adminKeys.pendingPhotos() });
        if (photoId !== null) {
          void queryClient.invalidateQueries({ queryKey: adminKeys.photoDetail(photoId) });
        }
        options?.onSuccess?.();
      },
      onError: () => {
        burnt.toast({ title: TOAST_ERROR, preset: 'error' });
      },
    },
  });

  function confirmAndBan() {
    Alert.alert(ALERT_TITLE, ALERT_MESSAGE, [
      { text: ALERT_CANCEL, style: 'cancel' },
      {
        text: ALERT_CONFIRM,
        style: 'destructive',
        onPress: () => {
          mutation.mutate({ id: userId });
        },
      },
    ]);
  }

  return { confirmAndBan, isPending: mutation.isPending };
}
