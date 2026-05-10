import * as burnt from 'burnt';

import type { CreateReportRequest } from '@/shared/generated/model/createReportRequest';
import { useReportPhoto } from '@/shared/generated/reports/reports';
import { HTTPError } from '@/shared/lib/api-client';

import type { ReportReasonId } from '../lib/reportReasons';

interface UseReportOptions {
  onSuccess?: () => void;
}

export interface ReportInput {
  reason: ReportReasonId;
  detail?: string;
}

/**
 * Wraps the generated `useReportPhoto` mutation. Returns `handleReport` as the
 * action verb to match `useUpvote.handleUpvote` in this feature.
 *
 * Side effects: shows a burnt toast on success and on each error class
 * (429 daily-cap, 400 self-report, anything else generic). The optional
 * `onSuccess` callback is invoked **after** the success toast, so callers
 * can dismiss the sheet without their close animation racing the toast.
 */
export function useReport(photoId: string, options?: UseReportOptions) {
  const mutation = useReportPhoto({
    mutation: {
      onSuccess: () => {
        burnt.toast({ title: REPORT_SUCCESS_TITLE, preset: 'done' });
        options?.onSuccess?.();
      },
      onError: (err) => {
        const title = resolveErrorTitle(err);
        burnt.toast({ title, preset: 'error' });
      },
    },
  });

  function handleReport(input: ReportInput) {
    const trimmed = input.detail?.trim();
    const data: CreateReportRequest = {
      reason: input.reason,
      ...(trimmed ? { detail: trimmed } : {}),
    };
    mutation.mutate({ photoId, data });
  }

  return { handleReport, isPending: mutation.isPending };
}

const REPORT_SUCCESS_TITLE = '신고가 접수되었습니다';
const REPORT_ERROR_TITLE = '신고를 처리하지 못했어요';
const DAILY_CAP_TITLE = '일일 신고 한도를 초과했습니다';
const REPORT_REJECTED_TITLE = '신고할 수 없는 사진입니다';

function resolveErrorTitle(err: unknown): string {
  if (err instanceof HTTPError) {
    if (err.response.status === 429) return DAILY_CAP_TITLE;
    if (err.response.status === 400) return REPORT_REJECTED_TITLE;
  }
  return REPORT_ERROR_TITLE;
}
