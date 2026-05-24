import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { PermissionStatus } from 'expo-modules-core';
import { Alert } from 'react-native';

import type { Gym } from '@/shared/types/database';

import { OwnerCoverPhotoScreen } from '../OwnerCoverPhotoScreen';

const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn<{ gym: string | undefined }, []>();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { WEBP: 'webp' },
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      resize: jest.fn().mockReturnThis(),
      renderAsync: jest.fn().mockResolvedValue({
        saveAsync: jest.fn().mockResolvedValue({ uri: 'file:///tmp/compressed.webp' }),
        release: jest.fn(),
      }),
      release: jest.fn(),
    })),
  },
}));

jest.mock('burnt', () => ({ toast: jest.fn() }));
jest.mock('@/shared/lib/sentry', () => ({ captureError: jest.fn() }));

const mockUseGymDetail = jest.fn<
  { data: Gym | undefined; isLoading: boolean; isError: boolean },
  [string | undefined]
>();
jest.mock('@/features/gym/hooks/useGymDetail', () => ({
  useGymDetail: (gymId: string | undefined) => mockUseGymDetail(gymId),
}));

const mockUploadMutateAsync = jest.fn<Promise<unknown>, [unknown]>();
const mockDeleteMutateAsync = jest.fn<Promise<unknown>, [unknown]>();
const mockUseUpload = jest.fn(() => ({ mutateAsync: mockUploadMutateAsync, isPending: false }));
const mockUseDelete = jest.fn(() => ({ mutateAsync: mockDeleteMutateAsync, isPending: false }));
jest.mock('@/shared/generated/owner/owner', () => ({
  useUploadGymCoverPhoto: () => mockUseUpload(),
  useDeleteGymCoverPhoto: () => mockUseDelete(),
}));

const originalFetch = global.fetch;

function gymFixture(overrides: Partial<Gym> = {}): Gym {
  return {
    id: 'gym-1',
    name: '아이언짐',
    address: '서울 강남구',
    latitude: 37.5,
    longitude: 127.0,
    phone: null,
    operating_hours: null,
    day_pass_price: null,
    is_verified: true,
    last_verified_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    cover_photo_url: null,
    ...overrides,
  };
}

function granted() {
  return {
    granted: true,
    canAskAgain: true,
    expires: 'never' as const,
    status: PermissionStatus.GRANTED,
  };
}

function pickerAsset(): ImagePicker.ImagePickerAsset {
  return {
    uri: 'file:///tmp/cover.jpg',
    width: 1600,
    height: 900,
    type: 'image',
    fileSize: 600_000,
    assetId: null,
    base64: null,
    duration: null,
    exif: null,
    fileName: 'cover.jpg',
    mimeType: 'image/jpeg',
    pairedVideoAsset: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocalSearchParams.mockReturnValue({ gym: 'gym-1' });
  mockUseGymDetail.mockReturnValue({
    data: gymFixture(),
    isLoading: false,
    isError: false,
  });
  global.fetch = jest.fn().mockResolvedValue({
    blob: () => Promise.resolve(new Blob(['fake'], { type: 'image/webp' })),
  });
});

afterAll(() => {
  global.fetch = originalFetch;
});

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <OwnerCoverPhotoScreen />
    </QueryClientProvider>,
  );
}

describe('OwnerCoverPhotoScreen', () => {
  it('renders placeholder + "사진 업로드" when no cover is set', () => {
    const { getByText, getByLabelText, queryByLabelText } = renderScreen();
    expect(getByText('아이언짐 대표 사진')).toBeTruthy();
    expect(getByLabelText('대표 사진 미설정 자리')).toBeTruthy();
    expect(getByText('사진 업로드')).toBeTruthy();
    expect(queryByLabelText('대표 사진 제거')).toBeNull();
  });

  it('renders image + "사진 변경" + remove when cover exists', () => {
    mockUseGymDetail.mockReturnValue({
      data: gymFixture({ cover_photo_url: 'https://example.com/cover.webp' }),
      isLoading: false,
      isError: false,
    });
    const { getByText, getByLabelText } = renderScreen();
    expect(getByLabelText('현재 대표 사진')).toBeTruthy();
    expect(getByText('사진 변경')).toBeTruthy();
    expect(getByLabelText('대표 사진 제거')).toBeTruthy();
  });

  it('uploads after the user picks from gallery', async () => {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue(granted());
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [pickerAsset()],
    });
    mockUploadMutateAsync.mockResolvedValue({
      data: { coverPhotoUrl: 'https://example.com/new.webp' },
    });

    const { getByText } = renderScreen();
    fireEvent.press(getByText('사진 업로드'));
    fireEvent.press(getByText('갤러리에서 선택'));

    await waitFor(() => {
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(mockUploadMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          gymId: 'gym-1',
          data: expect.objectContaining({ image: expect.any(Blob) }),
        }),
      );
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    });
  });

  it('confirms before removing via Alert', () => {
    mockUseGymDetail.mockReturnValue({
      data: gymFixture({ cover_photo_url: 'https://example.com/cover.webp' }),
      isLoading: false,
      isError: false,
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {
      // no-op: assertion runs on the spy's recorded args
    });

    const { getByLabelText } = renderScreen();
    fireEvent.press(getByLabelText('대표 사진 제거'));

    expect(alertSpy).toHaveBeenCalledWith(
      '대표 사진을 제거하시겠어요?',
      undefined,
      expect.arrayContaining([
        expect.objectContaining({ text: '취소' }),
        expect.objectContaining({ text: '제거', style: 'destructive' }),
      ]),
    );

    alertSpy.mockRestore();
  });
});
