import * as burnt from 'burnt';

import type { CreateReportRequest } from '@/shared/generated/model/createReportRequest';
import { useReportGymMachine as useReportGymMachineMutation } from '@/shared/generated/reports/reports';
import { HTTPError } from '@/shared/lib/api-client';

import type { ReportReasonId } from '../lib/reportReasons';

interface UseReportGymMachineOptions {
  onSuccess?: () => void;
}

export interface ReportGymMachineInput {
  reason: ReportReasonId;
  detail?: string;
}

/**
 * gym_machine 신고 mutation wrapper. ADR 0022 follow-up (Task 46). 사진 신고
 * (`useReport`) 와 동일한 toast 전략 + onSuccess 콜백 패턴. backend 가 사유
 * subset 을 거부하면 400, 일일 한도 초과 시 429.
 */
export function useReportGymMachine(gymMachineId: string, options?: UseReportGymMachineOptions) {
  const mutation = useReportGymMachineMutation({
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

  function handleReport(input: ReportGymMachineInput) {
    const trimmed = input.detail?.trim();
    const data: CreateReportRequest = {
      reason: input.reason,
      ...(trimmed ? { detail: trimmed } : {}),
    };
    mutation.mutate({ gymMachineId, data });
  }

  return { handleReport, isPending: mutation.isPending };
}

const REPORT_SUCCESS_TITLE = '신고가 접수되었습니다';
const REPORT_ERROR_TITLE = '신고를 처리하지 못했어요';
const DAILY_CAP_TITLE = '일일 신고 한도를 초과했습니다';
const REPORT_REJECTED_TITLE = '신고할 수 없는 사유입니다';

function resolveErrorTitle(err: unknown): string {
  if (err instanceof HTTPError) {
    if (err.response.status === 429) return DAILY_CAP_TITLE;
    if (err.response.status === 400) return REPORT_REJECTED_TITLE;
  }
  return REPORT_ERROR_TITLE;
}
