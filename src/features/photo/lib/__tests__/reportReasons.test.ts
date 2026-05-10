import { CreateReportRequestReason } from '@/shared/generated/model/createReportRequestReason';

import { GENERAL_REASONS, isOtherReason, URGENT_REASONS } from '../reportReasons';

describe('reportReasons', () => {
  it('exposes 4 general reasons', () => {
    expect(GENERAL_REASONS.map((r) => r.id)).toEqual([
      CreateReportRequestReason.INAPPROPRIATE,
      CreateReportRequestReason.WRONG_MACHINE,
      CreateReportRequestReason.DUPLICATE,
      CreateReportRequestReason.OTHER,
    ]);
  });

  it('keeps the urgent (legal/personal) reason in a separate group', () => {
    expect(URGENT_REASONS.map((r) => r.id)).toEqual([CreateReportRequestReason.LEGAL_PERSONAL]);
  });

  it('treats OTHER as the only reason that should reveal the textarea', () => {
    expect(isOtherReason(CreateReportRequestReason.OTHER)).toBe(true);
    expect(isOtherReason(CreateReportRequestReason.INAPPROPRIATE)).toBe(false);
    expect(isOtherReason(CreateReportRequestReason.LEGAL_PERSONAL)).toBe(false);
    expect(isOtherReason(null)).toBe(false);
  });
});
