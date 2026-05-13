import { useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';

import { useRestorePhoto as useRestorePhotoMutation } from '@/shared/generated/admin/admin';

import { adminKeys } from '../query-keys';

const TOAST_RESTORED = '사진 복구됨';
const TOAST_ERROR = '사진 복구에 실패했어요';

interface UseRestorePhotoOptions {
  onSuccess?: () => void;
}

export function useRestorePhotoAction(photoId: string, options?: UseRestorePhotoOptions) {
  const queryClient = useQueryClient();

  const mutation = useRestorePhotoMutation({
    mutation: {
      onSuccess: () => {
        burnt.toast({ title: TOAST_RESTORED, preset: 'done' });
        void queryClient.invalidateQueries({ queryKey: adminKeys.photoDetail(photoId) });
        void queryClient.invalidateQueries({ queryKey: adminKeys.pendingPhotos() });
        options?.onSuccess?.();
      },
      onError: () => {
        burnt.toast({ title: TOAST_ERROR, preset: 'error' });
      },
    },
  });

  function handleRestore() {
    mutation.mutate({ id: photoId });
  }

  return { handleRestore, isPending: mutation.isPending };
}
