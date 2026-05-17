import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { PermissionStatus } from 'expo-modules-core';

import { OwnerClaimScreen } from '../OwnerClaimScreen';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('burnt', () => ({ toast: jest.fn() }));

jest.mock('@/shared/lib/sentry', () => ({ captureError: jest.fn() }));

const mockMutateAsync = jest.fn();
const mockUseClaim = jest.fn<{ mutateAsync: jest.Mock; isPending: boolean }, []>();
jest.mock('@/shared/generated/owner/owner', () => ({
  useClaim: () => mockUseClaim(),
}));

// fetch is used to read the picked URI into a Blob before upload; jest-environment-jsdom
// supplies it but we override to return a known Blob.
const originalFetch = global.fetch;

function getBurntMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('burnt') as { toast: jest.Mock };
}

function granted() {
  return {
    granted: true,
    canAskAgain: true,
    expires: 'never' as const,
    status: PermissionStatus.GRANTED,
  };
}

function denied() {
  return {
    granted: false,
    canAskAgain: true,
    expires: 'never' as const,
    status: PermissionStatus.DENIED,
  };
}

function asset(
  overrides: Partial<ImagePicker.ImagePickerAsset> = {},
): ImagePicker.ImagePickerAsset {
  return {
    uri: 'file:///tmp/biz-reg.jpg',
    width: 1000,
    height: 1500,
    type: 'image',
    fileSize: 800_000,
    assetId: null,
    base64: null,
    duration: null,
    exif: null,
    fileName: 'biz-reg.jpg',
    mimeType: 'image/jpeg',
    pairedVideoAsset: null,
    ...overrides,
  };
}

function setupSuccessfulPickFromGallery() {
  jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue(granted());
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [asset()],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseClaim.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  });
  global.fetch = jest.fn().mockResolvedValue({
    blob: () => Promise.resolve(new Blob(['fake-bytes'], { type: 'image/jpeg' })),
  });
});

afterAll(() => {
  global.fetch = originalFetch;
});

function renderScreen() {
  return render(<OwnerClaimScreen gymId="gym-1" gymName="테스트 헬스장" />);
}

describe('OwnerClaimScreen — consent gate', () => {
  it('hides the photo-pick buttons until consent is checked', () => {
    const { queryByRole, getByRole } = renderScreen();
    expect(queryByRole('button', { name: '카메라로 촬영' })).toBeNull();
    expect(queryByRole('button', { name: '갤러리에서 선택' })).toBeNull();
    // Consent checkbox is present
    expect(getByRole('checkbox', { name: '개인정보 처리에 동의합니다' })).toBeTruthy();
  });

  it('reveals the photo-pick buttons after consent is checked', () => {
    const { getByRole } = renderScreen();
    fireEvent.press(getByRole('checkbox', { name: '개인정보 처리에 동의합니다' }));
    expect(getByRole('button', { name: '카메라로 촬영' })).toBeTruthy();
    expect(getByRole('button', { name: '갤러리에서 선택' })).toBeTruthy();
  });
});

describe('OwnerClaimScreen — image picking', () => {
  it('shows a toast when camera permission is denied', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue(denied());

    const { getByRole } = renderScreen();
    fireEvent.press(getByRole('checkbox', { name: '개인정보 처리에 동의합니다' }));
    fireEvent.press(getByRole('button', { name: '카메라로 촬영' }));

    await waitFor(() => {
      expect(getBurntMock().toast).toHaveBeenCalledWith({
        title: '카메라 권한이 필요해요',
        preset: 'error',
      });
    });
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('rejects oversize images (>2MB) before upload', async () => {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue(granted());
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [asset({ fileSize: 3_000_000 })],
    });

    const { getByRole, queryByText } = renderScreen();
    fireEvent.press(getByRole('checkbox', { name: '개인정보 처리에 동의합니다' }));
    fireEvent.press(getByRole('button', { name: '갤러리에서 선택' }));

    await waitFor(() => {
      expect(getBurntMock().toast).toHaveBeenCalledWith({
        title: '사진 크기는 2MB 이하여야 해요',
        preset: 'error',
      });
    });
    // Picked image preview did NOT appear
    expect(queryByText('선택된 사진')).toBeNull();
  });

  it('shows the picked image preview + submit button after a valid pick', async () => {
    setupSuccessfulPickFromGallery();

    const { getByRole, findByText } = renderScreen();
    fireEvent.press(getByRole('checkbox', { name: '개인정보 처리에 동의합니다' }));
    fireEvent.press(getByRole('button', { name: '갤러리에서 선택' }));

    await findByText('선택된 사진');
    expect(getByRole('button', { name: '제출하기' })).toBeTruthy();
  });

  it('silently returns when the user cancels the picker', async () => {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue(granted());
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: true,
      assets: null,
    });

    const { getByRole, queryByText } = renderScreen();
    fireEvent.press(getByRole('checkbox', { name: '개인정보 처리에 동의합니다' }));
    fireEvent.press(getByRole('button', { name: '갤러리에서 선택' }));

    await waitFor(() => {
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    });
    expect(queryByText('선택된 사진')).toBeNull();
    expect(getBurntMock().toast).not.toHaveBeenCalled();
  });
});

describe('OwnerClaimScreen — submission', () => {
  it('renders the submitting view while the claim mutation is pending', () => {
    mockUseClaim.mockReturnValueOnce({ mutateAsync: mockMutateAsync, isPending: true });
    const { getByText } = renderScreen();
    expect(getByText('검증 중...')).toBeTruthy();
    expect(getByText('10초 정도 걸려요. 잠시만 기다려 주세요.')).toBeTruthy();
  });

  it('calls the claim mutation with gymId + consent + image blob on submit', async () => {
    setupSuccessfulPickFromGallery();
    mockMutateAsync.mockResolvedValue({ data: { status: 'VERIFIED', gymId: 'gym-1' } });

    const { getByRole, findByRole } = renderScreen();
    fireEvent.press(getByRole('checkbox', { name: '개인정보 처리에 동의합니다' }));
    fireEvent.press(getByRole('button', { name: '갤러리에서 선택' }));
    fireEvent.press(await findByRole('button', { name: '제출하기' }));

    await waitFor(() => {
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { gymId: 'gym-1', consent: true },
          data: expect.objectContaining({ image: expect.any(Blob) }),
        }),
      );
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    });
  });

  it('renders the VERIFIED result view + owner-home button on success', async () => {
    setupSuccessfulPickFromGallery();
    mockMutateAsync.mockResolvedValue({
      data: { status: 'VERIFIED', gymId: 'gym-1', message: '인증 완료' },
    });

    const { getByRole, findByRole, findByText } = renderScreen();
    fireEvent.press(getByRole('checkbox', { name: '개인정보 처리에 동의합니다' }));
    fireEvent.press(getByRole('button', { name: '갤러리에서 선택' }));
    fireEvent.press(await findByRole('button', { name: '제출하기' }));

    await findByText('테스트 헬스장의 owner 가 되었어요');
    fireEvent.press(await findByRole('button', { name: 'owner 도구로 이동' }));
    expect(mockReplace).toHaveBeenCalledWith('/owner');
  });

  it('renders the DISPUTED result view with retry option', async () => {
    setupSuccessfulPickFromGallery();
    mockMutateAsync.mockResolvedValue({
      data: { status: 'DISPUTED', message: '이미 다른 사업자가 등록했어요' },
    });

    const { getByRole, findByRole, findByText } = renderScreen();
    fireEvent.press(getByRole('checkbox', { name: '개인정보 처리에 동의합니다' }));
    fireEvent.press(getByRole('button', { name: '갤러리에서 선택' }));
    fireEvent.press(await findByRole('button', { name: '제출하기' }));

    await findByText('검증이 보류되었어요');
    await findByText('이미 다른 사업자가 등록했어요');
    expect(await findByRole('button', { name: '다시 시도하기' })).toBeTruthy();
    expect(await findByRole('button', { name: '나중에 하기' })).toBeTruthy();
  });

  it('renders the FAILED result view + retry returns to picker', async () => {
    setupSuccessfulPickFromGallery();
    mockMutateAsync.mockResolvedValue({
      data: { status: 'FAILED', message: '사진을 읽을 수 없어요' },
    });

    const { getByRole, findByRole, findByText, queryByText } = renderScreen();
    fireEvent.press(getByRole('checkbox', { name: '개인정보 처리에 동의합니다' }));
    fireEvent.press(getByRole('button', { name: '갤러리에서 선택' }));
    fireEvent.press(await findByRole('button', { name: '제출하기' }));

    await findByText('검증에 실패했어요');
    fireEvent.press(await findByRole('button', { name: '다시 시도하기' }));
    // Back on the picker: result view gone, picked image cleared
    await waitFor(() => {
      expect(queryByText('검증에 실패했어요')).toBeNull();
    });
  });

  it('shows an error toast when the mutation throws', async () => {
    setupSuccessfulPickFromGallery();
    const networkErr = new Error('network down');
    mockMutateAsync.mockRejectedValue(networkErr);

    const { getByRole, findByRole } = renderScreen();
    fireEvent.press(getByRole('checkbox', { name: '개인정보 처리에 동의합니다' }));
    fireEvent.press(getByRole('button', { name: '갤러리에서 선택' }));
    fireEvent.press(await findByRole('button', { name: '제출하기' }));

    await waitFor(() => {
      expect(getBurntMock().toast).toHaveBeenCalledWith({
        title: '인증 요청에 실패했어요. 다시 시도해 주세요',
        preset: 'error',
      });
    });
  });
});
