import { fireEvent, render } from '@testing-library/react-native';
import type * as ReactNative from 'react-native';

import type * as BottomSheetMockModule from '@/test/utils/bottom-sheet-mock';

import { useReport } from '../../hooks/useReport';
import { ReportReasonSheet } from '../ReportReasonSheet';

jest.mock('@gorhom/bottom-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mock = require('@/test/utils/bottom-sheet-mock') as typeof BottomSheetMockModule;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native') as typeof ReactNative;
  return {
    __esModule: true,
    default: mock.BottomSheetPassthrough,
    BottomSheetModal: mock.BottomSheetModalPassthrough,
    BottomSheetModalProvider: mock.BottomSheetPassthrough,
    BottomSheetView: mock.BottomSheetPassthrough,
    BottomSheetTextInput: RN.TextInput,
    BottomSheetBackdrop: () => null,
  };
});

jest.mock('../../hooks/useReport', () => ({
  useReport: jest.fn(),
}));

// ADR 0022 follow-up (Task 46): ReportReasonSheet now resolves a gym_machine
// hook unconditionally even when target.type='photo'. Mock to avoid the real
// `burnt` import which Jest cannot parse.
jest.mock('../../hooks/useReportGymMachine', () => ({
  useReportGymMachine: jest.fn(() => ({ handleReport: jest.fn(), isPending: false })),
}));

const mockUseReport = useReport as jest.MockedFunction<typeof useReport>;

const PHOTO_ID = 'photo-1';
const ON_CLOSE = jest.fn();

interface SetupOpts {
  isPending?: boolean;
}

function setup({ isPending = false }: SetupOpts = {}) {
  const handleReport = jest.fn();
  mockUseReport.mockReturnValue({ handleReport, isPending });
  const utils = render(
    <ReportReasonSheet target={{ type: 'photo', photoId: PHOTO_ID }} onClose={ON_CLOSE} />,
  );
  return { ...utils, handleReport };
}

function setupVerified() {
  const handleReport = jest.fn();
  mockUseReport.mockReturnValue({ handleReport, isPending: false });
  const utils = render(
    <ReportReasonSheet
      target={{ type: 'photo', photoId: PHOTO_ID, verifiedByOwnerAt: '2026-05-18T10:00:00Z' }}
      onClose={ON_CLOSE}
    />,
  );
  return { ...utils, handleReport };
}

describe('ReportReasonSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders general and urgent sections with all reason options', () => {
    const { getByText } = setup();
    expect(getByText('일반 사유')).toBeTruthy();
    expect(getByText('긴급 (즉시 검토)')).toBeTruthy();
    expect(getByText('부적절한 사진 (NSFW / 폭력)')).toBeTruthy();
    expect(getByText('잘못된 기구 정보')).toBeTruthy();
    expect(getByText('중복 사진')).toBeTruthy();
    expect(getByText('기타')).toBeTruthy();
    expect(getByText('본인이 찍혔거나 법적 문제')).toBeTruthy();
  });

  it('keeps the textarea hidden until OTHER is selected', () => {
    const { queryByLabelText, getByLabelText } = setup();
    expect(queryByLabelText('신고 사유 자유 입력')).toBeNull();
    fireEvent.press(getByLabelText('기타'));
    expect(getByLabelText('신고 사유 자유 입력')).toBeTruthy();
  });

  it('hides the textarea again when a non-OTHER reason is selected', () => {
    const { queryByLabelText, getByLabelText } = setup();
    fireEvent.press(getByLabelText('기타'));
    expect(getByLabelText('신고 사유 자유 입력')).toBeTruthy();
    fireEvent.press(getByLabelText('중복 사진'));
    expect(queryByLabelText('신고 사유 자유 입력')).toBeNull();
  });

  it('disables the submit button until a reason is selected', () => {
    const { getByRole, handleReport } = setup();
    fireEvent.press(getByRole('button', { name: '신고 제출' }));
    expect(handleReport).not.toHaveBeenCalled();
  });

  it('submits the selected reason', () => {
    const { getByLabelText, getByRole, handleReport } = setup();
    fireEvent.press(getByLabelText('잘못된 기구 정보'));
    fireEvent.press(getByRole('button', { name: '신고 제출' }));
    expect(handleReport).toHaveBeenCalledWith({ reason: 'WRONG_MACHINE', detail: undefined });
  });

  it('submits OTHER with the typed detail', () => {
    const { getByLabelText, getByRole, handleReport } = setup();
    fireEvent.press(getByLabelText('기타'));
    fireEvent.changeText(getByLabelText('신고 사유 자유 입력'), '비슷한 사진이 너무 많아요');
    fireEvent.press(getByRole('button', { name: '신고 제출' }));
    expect(handleReport).toHaveBeenCalledWith({
      reason: 'OTHER',
      detail: '비슷한 사진이 너무 많아요',
    });
  });

  it('submits LEGAL_PERSONAL without a detail (urgent path)', () => {
    const { getByLabelText, getByRole, handleReport } = setup();
    fireEvent.press(getByLabelText('본인이 찍혔거나 법적 문제'));
    fireEvent.press(getByRole('button', { name: '신고 제출' }));
    expect(handleReport).toHaveBeenCalledWith({ reason: 'LEGAL_PERSONAL', detail: undefined });
  });

  it('disables the submit button while a request is in flight', () => {
    const { getByLabelText, getByRole } = setup({ isPending: true });
    fireEvent.press(getByLabelText('중복 사진'));
    expect(getByRole('button', { busy: true, disabled: true })).toBeTruthy();
  });

  it('renders the owner-verified amber banner when verifiedByOwnerAt is present', () => {
    const { getByTestId } = setupVerified();
    expect(getByTestId('owner-verified-warning-banner')).toBeTruthy();
  });

  it('does not render the owner-verified banner when verifiedByOwnerAt is absent', () => {
    const { queryByTestId } = setup();
    expect(queryByTestId('owner-verified-warning-banner')).toBeNull();
  });
});
