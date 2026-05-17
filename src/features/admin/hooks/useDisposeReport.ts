import { useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';

import { useDisposition } from '@/shared/generated/admin/admin';
import type { DispositionRequest } from '@/shared/generated/model/dispositionRequest';

import { adminKeys } from '../query-keys';

const TOAST_ACTIONED = '처리됨';
const TOAST_DISMISSED = '반려됨';
const TOAST_ERROR = '신고 처리에 실패했어요';

type Disposition = DispositionRequest['disposition'];

/**
 * ADR 0022 follow-up (Task 46) Slice 46h: gym_machine disposition requires the
 * admin to choose between re-template (with newTemplateId) and delete. Photo
 * dispositions ignore both extra fields.
 */
export interface DisposeOptions {
  disposition: Disposition;
  gymMachineAction?: 'reTemplate' | 'delete';
  newTemplateId?: string;
}

interface UseDisposeReportOptions {
  onSuccess?: () => void;
}

/**
 * Wraps the generated `useDisposition` mutation with admin-queue invalidation
 * and a disposition-specific toast. ADR 0022 follow-up (Task 46) Slice 46h:
 * generalized over photo + gym_machine. Caller threads `target` so the right
 * detail-query key is invalidated alongside the (now unified) queue.
 */
export function useDisposeReport(
  reportId: string,
  target: { type: 'photo'; photoId: string } | { type: 'gymMachine'; gymMachineId: string },
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
        void queryClient.invalidateQueries({ queryKey: adminKeys.pendingQueue() });
        // legacy photo queue key — kept invalidated for one release until
        // useAdminQueue's old callers fully migrate.
        void queryClient.invalidateQueries({ queryKey: adminKeys.pendingPhotos() });
        if (target.type === 'photo') {
          void queryClient.invalidateQueries({ queryKey: adminKeys.photoDetail(target.photoId) });
        } else {
          void queryClient.invalidateQueries({
            queryKey: adminKeys.gymMachineDetail(target.gymMachineId),
          });
        }
        options?.onSuccess?.();
      },
      onError: () => {
        burnt.toast({ title: TOAST_ERROR, preset: 'error' });
      },
    },
  });

  function handleDispose(opts: DisposeOptions) {
    const data: DispositionRequest = {
      disposition: opts.disposition,
      ...(opts.gymMachineAction ? { gymMachineAction: opts.gymMachineAction } : {}),
      ...(opts.newTemplateId ? { newTemplateId: opts.newTemplateId } : {}),
    };
    mutation.mutate({ id: reportId, data });
  }

  return { handleDispose, isPending: mutation.isPending };
}
