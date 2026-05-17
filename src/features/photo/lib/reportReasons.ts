import { CreateReportRequestReason } from '@/shared/generated/model/createReportRequestReason';

export type ReportReasonId = CreateReportRequestReason;

export interface ReportReasonOption {
  id: ReportReasonId;
  label: string;
}

/**
 * Photo report reasons. ADR 0022 follow-up (Task 46) — paired with
 * {@link GYM_MACHINE_REASONS} for the gym_machine surface. Backend validates
 * (target_type, reason) pairs in `ReportService` allowlists; this file is
 * the UI counterpart so users only see relevant reasons per surface.
 */
export const PHOTO_GENERAL_REASONS: readonly ReportReasonOption[] = [
  { id: CreateReportRequestReason.INAPPROPRIATE, label: '부적절한 사진 (NSFW / 폭력)' },
  { id: CreateReportRequestReason.WRONG_MACHINE, label: '잘못된 기구 정보' },
  { id: CreateReportRequestReason.DUPLICATE, label: '중복 사진' },
  { id: CreateReportRequestReason.OTHER, label: '기타' },
] as const;

export const PHOTO_URGENT_REASONS: readonly ReportReasonOption[] = [
  { id: CreateReportRequestReason.LEGAL_PERSONAL, label: '본인이 찍혔거나 법적 문제' },
] as const;

export const GYM_MACHINE_REASONS: readonly ReportReasonOption[] = [
  { id: CreateReportRequestReason.WRONG_TEMPLATE, label: '머신 종류가 잘못 매핑됨' },
  { id: CreateReportRequestReason.NOT_PRESENT, label: '이 헬스장에 없는 머신' },
  { id: CreateReportRequestReason.OTHER, label: '기타' },
] as const;

// Pre-Task-46 aliases kept for the photo ReportReasonSheet so the existing
// component code paths and tests stay green without a rename churn.
export const GENERAL_REASONS = PHOTO_GENERAL_REASONS;
export const URGENT_REASONS = PHOTO_URGENT_REASONS;

export function isOtherReason(id: ReportReasonId | null): boolean {
  return id === CreateReportRequestReason.OTHER;
}
