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

const mockBack = jest.fn();
interface MockParams {
  gymId: string;
  gymMachineId?: string;
  compressedUri: string;
}
const mockUseLocalSearchParams = jest.fn<MockParams, []>();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('@/features/upload/components/OcrScanAnimation', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
  const { View } = require('react-native');
  return { OcrScanAnimation: () => <View testID="ocr-scan-animation" /> };
});

jest.mock('@/features/upload/components/UploadProgressBar', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
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
        { id: 'sug-1', brandName: 'Life Fitness', name: '트레드밀' },
        { id: 'sug-2', brandName: 'Technogym', name: '런닝머신' },
        { id: 'sug-3', brandName: 'Matrix', name: '사이클' },
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

function buildErrorState(overrides = {}) {
  return {
    upload: jest.fn(),
    isUploading: false,
    uploadProgress: 0,
    uploadError: new Error('Network error'),
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

  it('shows "다시 시도" when ocrSucceeded is false', () => {
    mockUsePhotoUpload.mockReturnValue(buildOcrFailState());

    const { getByTestId, getByText } = render(<UploadConfirmScreen />);

    expect(getByText('기구를 인식하지 못했어요')).toBeTruthy();
    expect(getByTestId('upload-retry-btn')).toBeTruthy();
    expect(getByTestId('upload-direct-input')).toBeTruthy();
  });

  it('shows error view when uploadError is set', () => {
    mockUsePhotoUpload.mockReturnValue(buildErrorState());

    const { getByTestId, getByText } = render(<UploadConfirmScreen />);

    expect(getByText('업로드 중 오류가 발생했어요')).toBeTruthy();
    expect(getByTestId('upload-retry-btn')).toBeTruthy();
  });

  it('"다시 시도" calls upload()', () => {
    const upload = jest.fn();
    mockUsePhotoUpload.mockReturnValue(buildErrorState({ upload }));

    const { getByTestId } = render(<UploadConfirmScreen />);

    // upload is also called once on mount via useEffect
    fireEvent.press(getByTestId('upload-retry-btn'));

    expect(upload).toHaveBeenCalledTimes(2);
  });

  it('direct-input registration calls createGymMachine with freeFormName + no photoId on bound flow', async () => {
    mockUsePhotoUpload.mockReturnValue(buildOcrFailState());
    const mutateAsync = jest
      .fn()
      .mockResolvedValue({ gymMachineId: 'new-gm-1', pendingReview: true });
    mockUseCreateGymMachine.mockReturnValue(buildCreateMutation({ mutateAsync }));

    const { getByTestId } = render(<UploadConfirmScreen />);

    fireEvent.changeText(getByTestId('upload-direct-input'), '  Leg Press  ');
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

  it('orphan upload (no gymMachineId) sends photoId so backend binds the photo', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      gymId: 'gym-123',
      gymMachineId: undefined,
      compressedUri: 'file:///compressed.webp',
    });
    mockUsePhotoUpload.mockReturnValue(buildOcrSuccessState());
    const mutateAsync = jest
      .fn()
      .mockResolvedValue({ gymMachineId: 'new-gm-3', pendingReview: false });
    mockUseCreateGymMachine.mockReturnValue(buildCreateMutation({ mutateAsync }));

    const { getByTestId } = render(<UploadConfirmScreen />);

    fireEvent.press(getByTestId('upload-ocr-suggestion-sug-2'));
    fireEvent.press(getByTestId('upload-register-btn'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        data: { gymId: 'gym-123', templateId: 'sug-2', photoId: 'photo-1' },
      });
    });
  });

  it('orphan upload + OcrFail direct input sends freeFormName + photoId', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      gymId: 'gym-123',
      gymMachineId: undefined,
      compressedUri: 'file:///compressed.webp',
    });
    mockUsePhotoUpload.mockReturnValue(buildOcrFailState());
    const mutateAsync = jest
      .fn()
      .mockResolvedValue({ gymMachineId: 'new-gm-4', pendingReview: true });
    mockUseCreateGymMachine.mockReturnValue(buildCreateMutation({ mutateAsync }));

    const { getByTestId } = render(<UploadConfirmScreen />);

    fireEvent.changeText(getByTestId('upload-direct-input'), 'Hammer Strength MTS Row');
    fireEvent.press(getByTestId('upload-register-btn'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        data: {
          gymId: 'gym-123',
          freeFormName: 'Hammer Strength MTS Row',
          photoId: 'photo-1',
        },
      });
    });
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
});
