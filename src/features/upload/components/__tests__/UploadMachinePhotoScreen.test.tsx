import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { toast } from 'burnt';
import { useCameraPermissions } from 'expo-camera';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { PermissionStatus } from 'expo-modules-core';

import { useCreateGymMachine } from '@/shared/generated/machines/machines';
import { useUpload } from '@/shared/generated/photos/photos';

import { UploadMachinePhotoScreen } from '../UploadMachinePhotoScreen';

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      resize: jest.fn(),
      renderAsync: jest.fn(() =>
        Promise.resolve({
          saveAsync: jest.fn(() => Promise.resolve({ uri: 'file:///compressed.webp' })),
          release: jest.fn(),
        }),
      ),
      release: jest.fn(),
    })),
  },
  SaveFormat: { WEBP: 'webp' },
}));

const TEMPLATE_ID = '11111111-1111-1111-1111-111111111111';
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    gymId: 'gym-1',
    selection: JSON.stringify({
      kind: 'template',
      templateId: '11111111-1111-1111-1111-111111111111',
    }),
  }),
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('burnt', () => ({ toast: jest.fn() }));

jest.mock('@/shared/generated/photos/photos', () => ({ useUpload: jest.fn() }));
jest.mock('@/shared/generated/machines/machines', () => ({ useCreateGymMachine: jest.fn() }));

const mockUseCameraPermissions = jest.mocked(useCameraPermissions);
const mockLaunchImageLibraryAsync = jest.mocked(launchImageLibraryAsync);
const mockUseUpload = jest.mocked(useUpload);
const mockUseCreateGymMachine = jest.mocked(useCreateGymMachine);
const mockToast = jest.mocked(toast);

function grantCamera() {
  mockUseCameraPermissions.mockReturnValue([
    {
      granted: true,
      canAskAgain: true,
      expires: 'never' as const,
      status: PermissionStatus.GRANTED,
    },
    jest.fn(),
    jest.fn(),
  ]);
}

function mockMutations(createImpl?: jest.Mock) {
  const uploadPhoto = jest.fn().mockResolvedValue({ photoId: 'photo-1' });
  const createGymMachine =
    createImpl ??
    jest.fn().mockResolvedValue({ gymId: 'gym-1', gymMachineId: 'gm-1', pendingReview: false });
  // The screen only consumes `mutateAsync`; the rest of the UseMutationResult
  // is irrelevant to these tests.
  mockUseUpload.mockReturnValue({ mutateAsync: uploadPhoto } as unknown as ReturnType<
    typeof useUpload
  >);
  mockUseCreateGymMachine.mockReturnValue({
    mutateAsync: createGymMachine,
  } as unknown as ReturnType<typeof useCreateGymMachine>);
  return { uploadPhoto, createGymMachine };
}

describe('UploadMachinePhotoScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    grantCamera();
    mockMutations();
  });

  it('renders capture and gallery actions when camera permission is granted', () => {
    const { getByLabelText } = render(<UploadMachinePhotoScreen />);

    expect(getByLabelText('촬영하기')).toBeTruthy();
    expect(getByLabelText('갤러리에서 선택')).toBeTruthy();
  });

  it('does NOT register when the gallery picker is cancelled', async () => {
    const { createGymMachine } = mockMutations();
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });

    const { getByLabelText } = render(<UploadMachinePhotoScreen />);
    fireEvent.press(getByLabelText('갤러리에서 선택'));

    await waitFor(() => {
      expect(mockLaunchImageLibraryAsync).toHaveBeenCalledTimes(1);
    });
    expect(createGymMachine).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('uploads, registers, and navigates to the new gallery when a gallery asset is picked', async () => {
    const { uploadPhoto, createGymMachine } = mockMutations();
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg', width: 1920, height: 1080 }],
    });

    const { getByLabelText } = render(<UploadMachinePhotoScreen />);
    fireEvent.press(getByLabelText('갤러리에서 선택'));

    await waitFor(() => {
      expect(createGymMachine).toHaveBeenCalledTimes(1);
    });
    expect(uploadPhoto).toHaveBeenCalledTimes(1);
    expect(createGymMachine).toHaveBeenCalledWith({
      data: { gymId: 'gym-1', templateId: TEMPLATE_ID, photoId: 'photo-1' },
    });
    expect(mockReplace).toHaveBeenCalled();
  });

  it('shows an error toast when registration fails on the gallery path', async () => {
    const failingCreate = jest.fn().mockRejectedValue(new Error('boom'));
    mockMutations(failingCreate);
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.jpg', width: 1920, height: 1080 }],
    });

    const { getByLabelText } = render(<UploadMachinePhotoScreen />);
    fireEvent.press(getByLabelText('갤러리에서 선택'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '사진 처리 중 오류가 발생했어요', preset: 'error' }),
      );
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
