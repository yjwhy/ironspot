import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useCameraPermissions } from 'expo-camera';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { PermissionStatus } from 'expo-modules-core';
import { ActivityIndicator } from 'react-native';

import { UploadPhotoScreen } from '../UploadPhotoScreen';

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
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

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true, size: 200000 })),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ gymMachineId: 'gm-123', gymId: 'gym-123' }),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('burnt', () => ({ toast: jest.fn() }));

const mockUseCameraPermissions = jest.mocked(useCameraPermissions);
const mockLaunchImageLibraryAsync = jest.mocked(launchImageLibraryAsync);

function buildPermission(overrides: Partial<{ granted: boolean; canAskAgain: boolean }> = {}) {
  return {
    granted: false,
    canAskAgain: true,
    expires: 'never' as const,
    status: PermissionStatus.UNDETERMINED,
    ...overrides,
  };
}

describe('UploadPhotoScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders ActivityIndicator when permissions are loading (null)', () => {
    mockUseCameraPermissions.mockReturnValue([null, jest.fn(), jest.fn()]);

    const { UNSAFE_getByType } = render(<UploadPhotoScreen />);

    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders permission denied UI when permission is not granted and canAskAgain is true', () => {
    const requestMock = jest.fn();
    mockUseCameraPermissions.mockReturnValue([
      buildPermission({ granted: false, canAskAgain: true }),
      requestMock,
      jest.fn(),
    ]);

    const { getByText } = render(<UploadPhotoScreen />);

    expect(getByText('카메라 권한이 필요해요')).toBeTruthy();
    expect(getByText('권한 요청하기')).toBeTruthy();
  });

  it('renders "설정에서 변경하기" button when canAskAgain is false', () => {
    mockUseCameraPermissions.mockReturnValue([
      buildPermission({ granted: false, canAskAgain: false }),
      jest.fn(),
      jest.fn(),
    ]);

    const { getByText } = render(<UploadPhotoScreen />);

    expect(getByText('설정에서 변경하기')).toBeTruthy();
  });

  it('renders camera UI when permission is granted', () => {
    mockUseCameraPermissions.mockReturnValue([
      buildPermission({ granted: true }),
      jest.fn(),
      jest.fn(),
    ]);

    const { getByLabelText } = render(<UploadPhotoScreen />);

    expect(getByLabelText('촬영하기')).toBeTruthy();
    expect(getByLabelText('갤러리에서 선택')).toBeTruthy();
  });

  it('"갤러리에서 선택" does NOT navigate when picker returns cancelled', async () => {
    mockUseCameraPermissions.mockReturnValue([
      buildPermission({ granted: true }),
      jest.fn(),
      jest.fn(),
    ]);
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });

    const { getByLabelText } = render(<UploadPhotoScreen />);

    fireEvent.press(getByLabelText('갤러리에서 선택'));

    await waitFor(() => {
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it('"갤러리에서 선택" navigates with gymMachineId, gymId, and compressedUri when picker returns a valid asset', async () => {
    mockUseCameraPermissions.mockReturnValue([
      buildPermission({ granted: true }),
      jest.fn(),
      jest.fn(),
    ]);
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///original.jpg', width: 1920, height: 1080 }],
    });

    const { getByLabelText } = render(<UploadPhotoScreen />);

    fireEvent.press(getByLabelText('갤러리에서 선택'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(upload)/confirm',
        params: {
          gymMachineId: 'gm-123',
          gymId: 'gym-123',
          compressedUri: 'file:///compressed.webp',
        },
      });
    });
  });
});
