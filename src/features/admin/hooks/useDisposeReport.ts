import { useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';

import { useDisposition } from '@/shared/generated/admin/admin';
import type { DispositionRequest } from '@/shared/generated/model/dispositionRequest';

import { adminKeys } from '../query-keys';

const TOAST_ACTIONED = '처리됨';
const TOAST_DISMISSED = '반려됨';
const TOAST_ERROR = '신고 처리에 실패했어요';

type Disposition = DispositionRequest['disposition'];

interface UseDisposeReportOptions {
  onSuccess?: () => void;
}

/**
 * Wraps the generated `useDisposition` mutation with admin-queue invalidation
 * and a disposition-specific toast. Caller passes both `reportId` and
 * `photoId` so the photo-detail query (`adminKeys.photoDetail`) gets invalidated
 * alongside the queue.
 */
export function useDisposeReport(
  reportId: string,
  photoId: string,
  options?: UseDisposeReportOptions,
) {
  const queryClient = useQueryClient();

  const mutation = useDisposition({
    mutation: {
      onSuccess: (_data, variables) => {
        const disposition = variables.data.disposition;
        burnt.toast({
          title: disposition === 'actioned' ? TOAST_ACTIONED : TOAST_DISMISSED,
          preset: 'done',
        });
        void queryClient.invalidateQueries({ queryKey: adminKeys.pendingPhotos() });
        void queryClient.invalidateQueries({ queryKey: adminKeys.photoDetail(photoId) });
        options?.onSuccess?.();
      },
      onError: () => {
        burnt.toast({ title: TOAST_ERROR, preset: 'error' });
      },
    },
  });

  function handleDispose(disposition: Disposition) {
    mutation.mutate({ id: reportId, data: { disposition } });
  }

  return { handleDispose, isPending: mutation.isPending };
}
