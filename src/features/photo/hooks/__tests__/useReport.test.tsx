import { renderHook } from '@testing-library/react-native';
import * as burnt from 'burnt';

import { CreateReportRequestReason } from '@/shared/generated/model/createReportRequestReason';
import { useReportPhoto } from '@/shared/generated/reports/reports';

import { useReport } from '../useReport';

// ky ships ESM only; replace the api-client re-export with a minimal stand-in
// so `err instanceof HTTPError` works under Jest's transform settings.
jest.mock('@/shared/lib/api-client', () => {
  class HTTPError extends Error {
    response: { status: number };
    constructor(status: number) {
      super(`HTTP ${String(status)}`);
      this.response = { status };
    }
  }
  return { HTTPError };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { HTTPError } = require('@/shared/lib/api-client') as {
  HTTPError: new (status: number) => Error;
};

jest.mock('@/shared/generated/reports/reports', () => ({
  useReportPhoto: jest.fn(),
}));

jest.mock('burnt', () => ({
  toast: jest.fn(),
}));

interface CapturedOptions {
  mutation?: {
    onSuccess?: () => void;
    onError?: (err: unknown) => void;
  };
}

const PHOTO_ID = 'photo-1';

function setupHook(opts?: { onSuccess?: () => void }) {
  const mutate = jest.fn();
  let captured: CapturedOptions | undefined;
  (useReportPhoto as jest.Mock).mockImplementation((options: CapturedOptions) => {
    captured = options;
    return { mutate, isPending: false };
  });

  const { result } = renderHook(() => useReport(PHOTO_ID, opts));
  return { result, mutate, getCaptured: () => captured };
}

function makeHttpError(status: number): Error {
  return new HTTPError(status);
}

describe('useReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes the photoId and built CreateReportRequest to the mutation', () => {
    const { result, mutate } = setupHook();

    result.current.handleReport({
      reason: CreateReportRequestReason.INAPPROPRIATE,
    });

    expect(mutate).toHaveBeenCalledWith({
      photoId: PHOTO_ID,
      data: { reason: CreateReportRequestReason.INAPPROPRIATE },
    });
  });

  it('omits empty/whitespace detail from the payload', () => {
    const { result, mutate } = setupHook();

    result.current.handleReport({
      reason: CreateReportRequestReason.OTHER,
      detail: '   ',
    });

    expect(mutate).toHaveBeenCalledWith({
      photoId: PHOTO_ID,
      data: { reason: CreateReportRequestReason.OTHER },
    });
  });

  it('trims and includes detail when provided', () => {
    const { result, mutate } = setupHook();

    result.current.handleReport({
      reason: CreateReportRequestReason.OTHER,
      detail: '  주변에 있는 사진이에요  ',
    });

    expect(mutate).toHaveBeenCalledWith({
      photoId: PHOTO_ID,
      data: { reason: CreateReportRequestReason.OTHER, detail: '주변에 있는 사진이에요' },
    });
  });

  it('shows a success toast and invokes onSuccess after the mutation succeeds', () => {
    const onSuccess = jest.fn();
    const { getCaptured } = setupHook({ onSuccess });

    getCaptured()?.mutation?.onSuccess?.();

    expect(burnt.toast).toHaveBeenCalledWith({
      title: '신고가 접수되었습니다',
      preset: 'done',
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('shows the daily cap toast on 429', () => {
    const { getCaptured } = setupHook();

    getCaptured()?.mutation?.onError?.(makeHttpError(429));

    expect(burnt.toast).toHaveBeenCalledWith({
      title: '일일 신고 한도를 초과했습니다',
      preset: 'error',
    });
  });

  it('shows the rejected toast on 400 (self-report)', () => {
    const { getCaptured } = setupHook();

    getCaptured()?.mutation?.onError?.(makeHttpError(400));

    expect(burnt.toast).toHaveBeenCalledWith({
      title: '신고할 수 없는 사진입니다',
      preset: 'error',
    });
  });

  it('falls back to a generic toast for unrecognised errors', () => {
    const { getCaptured } = setupHook();

    getCaptured()?.mutation?.onError?.(new Error('network down'));

    expect(burnt.toast).toHaveBeenCalledWith({
      title: '신고를 처리하지 못했어요',
      preset: 'error',
    });
  });
});
