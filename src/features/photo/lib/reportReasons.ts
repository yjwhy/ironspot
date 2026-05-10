import { CreateReportRequestReason } from '@/shared/generated/model/createReportRequestReason';

export type ReportReasonId = CreateReportRequestReason;

export interface ReportReasonOption {
  id: ReportReasonId;
  label: string;
}

export const GENERAL_REASONS: readonly ReportReasonOption[] = [
  { id: CreateReportRequestReason.INAPPROPRIATE, label: '부적절한 사진 (NSFW / 폭력)' },
  { id: CreateReportRequestReason.WRONG_MACHINE, label: '잘못된 기구 정보' },
  { id: CreateReportRequestReason.DUPLICATE, label: '중복 사진' },
  { id: CreateReportRequestReason.OTHER, label: '기타' },
] as const;

export const URGENT_REASONS: readonly ReportReasonOption[] = [
  { id: CreateReportRequestReason.LEGAL_PERSONAL, label: '본인이 찍혔거나 법적 문제' },
] as const;

export function isOtherReason(id: ReportReasonId | null): boolean {
  return id === CreateReportRequestReason.OTHER;
}
