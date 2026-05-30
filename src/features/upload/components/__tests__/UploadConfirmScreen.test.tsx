/* eslint-disable @typescript-eslint/no-unsafe-assignment -- jest's expect.objectContaining returns any; narrowing it would defeat the matcher API */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as burnt from 'burnt';

import { usePhotoUpload } from '@/features/upload/hooks/usePhotoUpload';
import { useCreateGymMachine } from '@/shared/generated/machines/machines';

import { UploadConfirmScreen } from '../UploadConfirmScreen';

jest.mock('@/features/upload/hooks/usePhotoUpload', () => ({
  usePhotoUpload: jest.fn(),
}));

jest.mock('@/shared/generated/machines/machines', () => ({
  useCreateGymMachine: jest.fn(),
}));

// MachinePicker pulls the brand / category / template catalog via TanStack
// Query. Mock the hooks so the picker renders without a QueryClient and so
// tests can drive a deterministic catalog when exercising the escape hatch.
jest.mock('@/features/map/hooks/useBrands', () => ({
  useBrands: () => ({
    data: [
      { id: 'brand-hammer', name: 'Hammer Strength', nameKo: '해머 스트렝스' },
      { id: 'brand-life', name: 'Life Fitness', nameKo: '라이프 피트니스' },
    ],
  }),
}));
jest.mock('@/features/map/hooks/useCategories', () => ({
  useCategories: () => ({
    data: [
      { id: 'cat-chest', name: '가슴' },
      { id: 'cat-back', name: '등' },
    ],
  }),
}));
jest.mock('@/features/map/hooks/useSeries', () => ({
  useSeries: () => ({ data: [] }),
}));
jest.mock('@/features/map/hooks/useMachineTemplates', () => ({
  useMachineTemplates: () => ({
    data: [
      {
        id: 'tpl-hammer-chest',
        brandId: 'brand-hammer',
        brandName: 'Hammer Strength',
        brandNameKo: '해머 스트렝스',
        categoryId: 'cat-chest',
        name: 'Iso Chest Press',
        loadingType: 'plate',
      },
    ],
  }),
}));

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
interface MockParams {
  gymId: string;
  gymMachineId?: string;
  compressedUri: string;
}
const mockUseLocalSearchParams = jest.fn<MockParams, []>();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
}));

jest.mock('@/features/upload/components/OcrScanAnimation', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { OcrScanAnimation: () => <View testID="ocr-scan-animation" /> };
});

jest.mock('@/features/upload/components/UploadProgressBar', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    UploadProgressBar: ({ progress }: { progress: number }) => (
      <View accessibilityValue={{ now: progress }} />
    ),
  };
});

jest.mock('burnt', () => ({ toast: jest.fn() }));

const mockUsePhotoUpload = usePhotoUpload as jest.Mock;
const mockUseCreateGymMachine = useCreateGymMachine as jest.Mock;

function buildUploadingState(overrides = {}) {
  return {
    upload: jest.fn(),
    isUploading: true,
    uploadProgress: 0.5,
    uploadError: null,
    result: null,
    ...overrides,
  };
}

function buildOcrSuccessState(overrides = {}) {
  return {
    upload: jest.fn(),
    isUploading: false,
    uploadProgress: 1,
    uploadError: null,
    result: {
      photoId: 'photo-1',
      photoUrl: 'https://example.com/photo.webp',
      ocrSucceeded: true,
      suggestions: [
        { id: 'sug-1', brandName: 'Life Fitness', nameEn: 'Treadmill', nameKo: '트레드밀' },
        { id: 'sug-2', brandName: 'Technogym', nameEn: 'Running Machine', nameKo: '런닝머신' },
        { id: 'sug-3', brandName: 'Matrix', nameEn: 'Cycle', nameKo: '사이클' },
      ],
    },
    ...overrides,
  };
}

function buildOcrFailState(overrides = {}) {
  return {
    upload: jest.fn(),
    isUploading: false,
    uploadProgress: 1,
    uploadError: null,
    result: {
      photoId: 'photo-1',
      photoUrl: 'https://example.com/photo.webp',
      ocrSucceeded: false,
      suggestions: [],
    },
    ...overrides,
  };
}

function buildGenericErrorState(overrides = {}) {
  return {
    upload: jest.fn(),
    isUploading: false,
    uploadProgress: 0,
    uploadError: { kind: 'generic' as const, error: new Error('Network error') },
    result: null,
    ...overrides,
  };
}

function buildQuotaErrorState(overrides = {}) {
  return {
    upload: jest.fn(),
    isUploading: false,
    uploadProgress: 0,
    uploadError: { kind: 'quota' as const },
    result: null,
    ...overrides,
  };
}

function buildCreateMutation(overrides: { mutateAsync?: jest.Mock; isPending?: boolean } = {}) {
  return {
    mutateAsync:
      overrides.mutateAsync ??
      // apiClient returns the bare response body at runtime — unwrapOrvalResponse
      // is identity. Mock resolves with the unwrapped shape so handleRegister's
      // toast branch reads pendingReview correctly.
      jest.fn().mockResolvedValue({ gymMachineId: 'new-gm-1', pendingReview: false }),
    isPending: overrides.isPending ?? false,
  };
}

describe('UploadConfirmScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({
      gymId: 'gym-123',
      gymMachineId: 'gm-123',
      compressedUri: 'file:///compressed.webp',
    });
    mockUseCreateGymMachine.mockReturnValue(buildCreateMutation());
  });

  it('shows UploadingView (OcrScanAnimation + UploadProgressBar) while uploading', () => {
    mockUsePhotoUpload.mockReturnValue(buildUploadingState());

    const { getByTestId } = render(<UploadConfirmScreen />);

    expect(getByTestId('ocr-scan-animation')).toBeTruthy();
    expect(getByTestId('upload-progress-bar')).toBeTruthy();
    expect(getByTestId('upload-photo-preview')).toBeTruthy();
  });

  it('shows OCR suggestions when ocrSucceeded is true', () => {
    mockUsePhotoUpload.mockReturnValue(buildOcrSuccessState());

    const { getByTestId, getByText } = render(<UploadConfirmScreen />);

    expect(getByTestId('upload-ocr-suggestion-sug-1')).toBeTruthy();
    expect(getByTestId('upload-ocr-suggestion-sug-2')).toBeTruthy();
    expect(getByTestId('upload-ocr-suggestion-sug-3')).toBeTruthy();
    expect(getByText('Life Fitness 트레드밀')).toBeTruthy();
    expect(getByTestId('upload-direct-input')).toBeTruthy();
    expect(getByTestId('upload-register-btn')).toBeTruthy();
  });

  it('OcrFail mounts the closed-list picker + retry button + persistent escape hatch', () => {
    mockUsePhotoUpload.mockReturnValue(buildOcrFailState());

    const { getByTestId, getByText } = render(<UploadConfirmScreen />);

    expect(getByText('머신을 인식하지 못했어요')).toBeTruthy();
    expect(getByTestId('upload-retry-btn')).toBeTruthy();
    expect(getByTestId('machine-picker')).toBeTruthy();
    expect(getByTestId('machine-picker-escape-link')).toBeTruthy();
  });

  it('shows error view when uploadError is set', () => {
    mockUsePhotoUpload.mockReturnValue(buildGenericErrorState());

    const { getByTestId, getByText } = render(<UploadConfirmScreen />);

    expect(getByText('업로드 중 오류가 발생했어요')).toBeTruthy();
    expect(getByTestId('upload-retry-btn')).toBeTruthy();
  });

  it('"다시 시도" calls upload()', () => {
    const upload = jest.fn();
    mockUsePhotoUpload.mockReturnValue(buildGenericErrorState({ upload }));

    const { getByTestId } = render(<UploadConfirmScreen />);

    // upload is also called once on mount via useEffect
    fireEvent.press(getByTestId('upload-retry-btn'));

    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('quota error: shows hourly-limit copy and hides the retry CTA', () => {
    // Phase 5 item 11 slice (d): a 429 from the orphan quota wall renders
    // quota-specific copy with NO retry button — retry against quota is a
    // no-op until the rolling window clears.
    mockUsePhotoUpload.mockReturnValue(buildQuotaErrorState());

    const { getByTestId, getByText, queryByTestId } = render(<UploadConfirmScreen />);

    expect(getByTestId('upload-error-quota')).toBeTruthy();
    expect(getByText(/시간당 업로드 한도를 초과했어요/)).toBeTruthy();
    expect(queryByTestId('upload-retry-btn')).toBeNull();
  });

  it('OcrFail escape-hatch free-text registration calls createGymMachine with freeFormName + no photoId on bound flow', async () => {
    mockUsePhotoUpload.mockReturnValue(buildOcrFailState());
    const mutateAsync = jest
      .fn()
      .mockResolvedValue({ gymMachineId: 'new-gm-1', pendingReview: true });
    mockUseCreateGymMachine.mockReturnValue(buildCreateMutation({ mutateAsync }));

    const { getByTestId } = render(<UploadConfirmScreen />);

    fireEvent.press(getByTestId('machine-picker-escape-link'));
    fireEvent.changeText(getByTestId('machine-picker-freeform-input'), '  Leg Press  ');
    fireEvent.press(getByTestId('upload-register-btn'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        data: { gymId: 'gym-123', freeFormName: 'Leg Press' },
      });
      expect(burnt.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '등록 요청을 보냈어요',
          message: '검토 후 반영될 거예요',
          preset: 'done',
        }),
      );
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });

  it('OcrFail closed-list template pick calls createGymMachine with templateId', async () => {
    mockUsePhotoUpload.mockReturnValue(buildOcrFailState());
    const mutateAsync = jest
      .fn()
      .mockResolvedValue({ gymMachineId: 'new-gm-7', pendingReview: false });
    mockUseCreateGymMachine.mockReturnValue(buildCreateMutation({ mutateAsync }));

    const { getByTestId } = render(<UploadConfirmScreen />);

    fireEvent.press(getByTestId('machine-picker-brand-option-brand-hammer'));
    fireEvent.press(getByTestId('machine-picker-category-chip-cat-chest'));
    fireEvent.press(getByTestId('machine-picker-template-option-tpl-hammer-chest'));
    fireEvent.press(getByTestId('upload-register-btn'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        data: { gymId: 'gym-123', templateId: 'tpl-hammer-chest' },
      });
      expect(burnt.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '등록됐어요', preset: 'done' }),
      );
    });
  });

  it('closed-list pick on bound upload calls createGymMachine with templateId and omits photoId', async () => {
    mockUsePhotoUpload.mockReturnValue(buildOcrSuccessState());
    const mutateAsync = jest
      .fn()
      .mockResolvedValue({ gymMachineId: 'new-gm-2', pendingReview: false });
    mockUseCreateGymMachine.mockReturnValue(buildCreateMutation({ mutateAsync }));

    const { getByTestId } = render(<UploadConfirmScreen />);

    fireEvent.press(getByTestId('upload-ocr-suggestion-sug-1'));
    fireEvent.press(getByTestId('upload-register-btn'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        data: { gymId: 'gym-123', templateId: 'sug-1' },
      });
      expect(burnt.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '등록됐어요', preset: 'done' }),
      );
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });

  it('orphan upload (no gymMachineId) navigates to whole-machine capture instead of registering inline', async () => {
    // Phase 5 follow-up G: the new-machine path no longer registers from
    // the confirm screen. After the user picks a template, we route to
    // /(upload)/machine-photo where the whole-machine photo is captured
    // and the upload + register pipeline runs in one shot.
    mockUseLocalSearchParams.mockReturnValue({
      gymId: 'gym-123',
      gymMachineId: undefined,
      compressedUri: 'file:///compressed.webp',
    });
    mockUsePhotoUpload.mockReturnValue(buildOcrSuccessState());
    const mutateAsync = jest.fn();
    mockUseCreateGymMachine.mockReturnValue(buildCreateMutation({ mutateAsync }));

    const { getByTestId } = render(<UploadConfirmScreen />);

    fireEvent.press(getByTestId('upload-ocr-suggestion-sug-2'));
    fireEvent.press(getByTestId('upload-register-btn'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/(upload)/machine-photo',
          params: expect.objectContaining({
            gymId: 'gym-123',
            selection: JSON.stringify({ kind: 'template', templateId: 'sug-2' }),
          }),
        }),
      );
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('orphan upload + OcrFail escape-hatch free-text navigates to whole-machine capture with freeForm selection', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      gymId: 'gym-123',
      gymMachineId: undefined,
      compressedUri: 'file:///compressed.webp',
    });
    mockUsePhotoUpload.mockReturnValue(buildOcrFailState());
    const mutateAsync = jest.fn();
    mockUseCreateGymMachine.mockReturnValue(buildCreateMutation({ mutateAsync }));

    const { getByTestId } = render(<UploadConfirmScreen />);

    fireEvent.press(getByTestId('machine-picker-escape-link'));
    fireEvent.changeText(getByTestId('machine-picker-freeform-input'), 'Hammer Strength MTS Row');
    fireEvent.press(getByTestId('upload-register-btn'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/(upload)/machine-photo',
          params: expect.objectContaining({
            gymId: 'gym-123',
            selection: JSON.stringify({ kind: 'freeForm', text: 'Hammer Strength MTS Row' }),
          }),
        }),
      );
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('missing gymId surfaces an error toast and does not call the mutation', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      gymId: undefined as unknown as string,
      gymMachineId: 'gm-123',
      compressedUri: 'file:///compressed.webp',
    });
    mockUsePhotoUpload.mockReturnValue(buildOcrSuccessState());
    const mutateAsync = jest.fn();
    mockUseCreateGymMachine.mockReturnValue(buildCreateMutation({ mutateAsync }));

    const { getByTestId } = render(<UploadConfirmScreen />);

    fireEvent.press(getByTestId('upload-ocr-suggestion-sug-1'));
    fireEvent.press(getByTestId('upload-register-btn'));

    await waitFor(() => {
      expect(burnt.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '등록할 헬스장 정보가 없어요', preset: 'error' }),
      );
    });
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('synchronous double-tap of register button only calls the mutation once', async () => {
    mockUsePhotoUpload.mockReturnValue(buildOcrSuccessState());
    // Pin isPending=true on the second render so the guard catches even if
    // React Native's Button does not swallow the repeat press.
    const mutateAsync = jest
      .fn()
      .mockResolvedValue({ gymMachineId: 'new-gm-5', pendingReview: false });
    mockUseCreateGymMachine.mockReturnValue(buildCreateMutation({ mutateAsync }));

    const { getByTestId } = render(<UploadConfirmScreen />);

    fireEvent.press(getByTestId('upload-ocr-suggestion-sug-1'));
    fireEvent.press(getByTestId('upload-register-btn'));
    fireEvent.press(getByTestId('upload-register-btn'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  it('failed mutation surfaces error toast and does not navigate back', async () => {
    mockUsePhotoUpload.mockReturnValue(buildOcrSuccessState());
    const mutateAsync = jest.fn().mockRejectedValue(new Error('500'));
    mockUseCreateGymMachine.mockReturnValue(buildCreateMutation({ mutateAsync }));

    const { getByTestId } = render(<UploadConfirmScreen />);

    fireEvent.press(getByTestId('upload-ocr-suggestion-sug-1'));
    fireEvent.press(getByTestId('upload-register-btn'));

    await waitFor(() => {
      expect(burnt.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '등록에 실패했어요', preset: 'error' }),
      );
      expect(mockBack).not.toHaveBeenCalled();
    });
  });

  it('orphan upload + OcrFail closed-list template pick navigates to whole-machine capture', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      gymId: 'gym-123',
      gymMachineId: undefined,
      compressedUri: 'file:///compressed.webp',
    });
    mockUsePhotoUpload.mockReturnValue(buildOcrFailState());
    const mutateAsync = jest.fn();
    mockUseCreateGymMachine.mockReturnValue(buildCreateMutation({ mutateAsync }));

    const { getByTestId } = render(<UploadConfirmScreen />);

    fireEvent.press(getByTestId('machine-picker-brand-option-brand-hammer'));
    fireEvent.press(getByTestId('machine-picker-category-chip-cat-chest'));
    fireEvent.press(getByTestId('machine-picker-template-option-tpl-hammer-chest'));
    fireEvent.press(getByTestId('upload-register-btn'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/(upload)/machine-photo',
          params: expect.objectContaining({
            gymId: 'gym-123',
            selection: JSON.stringify({ kind: 'template', templateId: 'tpl-hammer-chest' }),
          }),
        }),
      );
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('OcrSuccess: tapping an OCR radio after browsing the picker discards in-progress freeform text', async () => {
    mockUsePhotoUpload.mockReturnValue(buildOcrSuccessState());
    const mutateAsync = jest
      .fn()
      .mockResolvedValue({ gymMachineId: 'new-gm-8', pendingReview: false });
    mockUseCreateGymMachine.mockReturnValue(buildCreateMutation({ mutateAsync }));

    const { getByTestId } = render(<UploadConfirmScreen />);

    fireEvent.press(getByTestId('upload-direct-input'));
    fireEvent.press(getByTestId('machine-picker-escape-link'));
    fireEvent.changeText(getByTestId('machine-picker-freeform-input'), 'mid-typing draft');
    fireEvent.press(getByTestId('upload-ocr-suggestion-sug-1'));
    fireEvent.press(getByTestId('upload-register-btn'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        data: { gymId: 'gym-123', templateId: 'sug-1' },
      });
    });
  });

  it('OcrFail: whitespace-only freeform input keeps the register button disabled', () => {
    mockUsePhotoUpload.mockReturnValue(buildOcrFailState());
    const mutateAsync = jest.fn();
    mockUseCreateGymMachine.mockReturnValue(buildCreateMutation({ mutateAsync }));

    const { getByTestId, queryByTestId } = render(<UploadConfirmScreen />);

    fireEvent.press(getByTestId('machine-picker-escape-link'));
    fireEvent.changeText(getByTestId('machine-picker-freeform-input'), '   ');

    // Register button is conditionally rendered on OcrFail — absence is the
    // disabled state we ship.
    expect(queryByTestId('upload-register-btn')).toBeNull();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
