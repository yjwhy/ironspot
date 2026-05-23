/* eslint-disable @typescript-eslint/no-unsafe-assignment -- jest's expect.objectContaining / expect.any return any; narrowing them would defeat the matcher API */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Image } from 'react-native';

import { UploadCropScreen } from '../UploadCropScreen';

const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    compressedUri: 'file://compressed.webp',
    gymMachineId: 'gm-1',
  }),
  useRouter: () => ({ replace: mockRouterReplace }),
  Stack: { Screen: () => null },
}));

jest.mock('burnt', () => ({
  toast: jest.fn(),
}));

interface FakeImageRef {
  saveAsync: jest.Mock;
  release: jest.Mock;
}
interface FakeContext {
  crop: jest.Mock;
  renderAsync: jest.Mock<Promise<FakeImageRef>>;
  release: jest.Mock;
}

const mockRenderAsync: jest.Mock<Promise<FakeImageRef>> = jest.fn();
const mockSaveAsync: jest.Mock<Promise<{ uri: string }>> = jest.fn();
const mockRelease: jest.Mock<void, []> = jest.fn();
const mockCrop: jest.Mock<void, [unknown]> = jest.fn();
const mockManipulate: jest.Mock<FakeContext, [string]> = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { WEBP: 'webp' },
  ImageManipulator: {
    manipulate: (uri: string) => mockManipulate(uri),
  },
}));

beforeEach(function resetMocks() {
  mockRouterReplace.mockReset();
  mockRenderAsync.mockReset();
  mockSaveAsync.mockReset();
  mockRelease.mockReset();
  mockCrop.mockReset();
  mockManipulate.mockReset();

  mockSaveAsync.mockResolvedValue({ uri: 'file://cropped.webp' });
  mockRenderAsync.mockResolvedValue({
    saveAsync: mockSaveAsync,
    release: mockRelease,
  });
  mockManipulate.mockReturnValue({
    crop: mockCrop,
    renderAsync: mockRenderAsync,
    release: mockRelease,
  });
});

describe('UploadCropScreen', () => {
  it('shows loading state until natural size resolves', () => {
    jest.spyOn(Image, 'getSize').mockImplementation(() => undefined);
    render(<UploadCropScreen />);
    expect(screen.getByTestId('upload-crop-loading')).toBeTruthy();
  });

  it('renders preview + skip button once natural size is known', async () => {
    jest.spyOn(Image, 'getSize').mockImplementation((_uri, onSize) => {
      onSize(1200, 900);
    });
    render(<UploadCropScreen />);
    expect(await screen.findByTestId('upload-crop-preview')).toBeTruthy();
    expect(screen.getByTestId('upload-crop-skip')).toBeTruthy();
    expect(screen.getByTestId('upload-crop-rect')).toBeTruthy();
  });

  it('navigates to confirm with the original URI on skip', async () => {
    jest.spyOn(Image, 'getSize').mockImplementation((_uri, onSize) => {
      onSize(1200, 900);
    });
    render(<UploadCropScreen />);
    fireEvent.press(await screen.findByTestId('upload-crop-skip'));
    expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: '/(upload)/confirm',
      params: expect.objectContaining({
        compressedUri: 'file://compressed.webp',
        gymMachineId: 'gm-1',
      }),
    });
  });

  it('runs ImageManipulator crop and routes to confirm with the cropped URI', async () => {
    jest.spyOn(Image, 'getSize').mockImplementation((_uri, onSize) => {
      onSize(1200, 900);
    });
    render(<UploadCropScreen />);
    fireEvent.press(await screen.findByTestId('upload-crop-confirm'));

    await waitFor(function navigated() {
      expect(mockRouterReplace).toHaveBeenCalledWith({
        pathname: '/(upload)/confirm',
        params: expect.objectContaining({
          compressedUri: 'file://cropped.webp',
        }),
      });
    });

    expect(mockManipulate).toHaveBeenCalledWith('file://compressed.webp');
    expect(mockCrop).toHaveBeenCalledWith(
      expect.objectContaining({
        originX: expect.any(Number),
        originY: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
      }),
    );
  });
});
