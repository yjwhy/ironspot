import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as burnt from 'burnt';

import { usePhotoUpload } from '@/features/upload/hooks/usePhotoUpload';

import { UploadConfirmScreen } from '../UploadConfirmScreen';

jest.mock('@/features/upload/hooks/usePhotoUpload', () => ({
  usePhotoUpload: jest.fn(),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    gymMachineId: 'gm-123',
    compressedUri: 'file:///compressed.webp',
  }),
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

describe('UploadConfirmScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('registers with direct input text when ocrSucceeded=false', async () => {
    mockUsePhotoUpload.mockReturnValue(buildOcrFailState());

    const { getByTestId } = render(<UploadConfirmScreen />);

    fireEvent.changeText(getByTestId('upload-direct-input'), 'Leg Press');

    fireEvent.press(getByTestId('upload-register-btn'));

    await waitFor(() => {
      expect(burnt.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '사진이 등록됐어요!', preset: 'done' }),
      );
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });

  it('"등록하기" shows success toast and navigates back', async () => {
    mockUsePhotoUpload.mockReturnValue(buildOcrSuccessState());

    const { getByTestId } = render(<UploadConfirmScreen />);

    // Select first suggestion to enable register button
    fireEvent.press(getByTestId('upload-ocr-suggestion-sug-1'));
    fireEvent.press(getByTestId('upload-register-btn'));

    await waitFor(() => {
      expect(burnt.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '사진이 등록됐어요!', preset: 'done' }),
      );
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });
});
