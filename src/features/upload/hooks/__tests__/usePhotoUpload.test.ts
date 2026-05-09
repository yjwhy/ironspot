import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { PhotoUploadResponse } from '@/shared/generated/model';
import { useUpload } from '@/shared/generated/photos/photos';
import { createQueryWrapper } from '@/test/utils/query-wrapper';

import { usePhotoUpload } from '../usePhotoUpload';

jest.mock('@/shared/generated/photos/photos', () => ({
  useUpload: jest.fn(),
}));

const mockMutateAsync = jest.fn();
const makeMockUpload = (overrides?: Partial<ReturnType<typeof useUpload>>) => ({
  mutateAsync: mockMutateAsync,
  isPending: false,
  isError: false,
  isSuccess: false,
  reset: jest.fn(),
  ...overrides,
});

const GYM_MACHINE_ID = 'gm-test-1';
const COMPRESSED_URI = 'file:///tmp/compressed.jpg';

const mockUploadResponse: { data: PhotoUploadResponse; status: 201; headers: Headers } = {
  data: {
    photoId: 'photo-123',
    photoUrl: 'https://cdn.example.com/photo-123.jpg',
    ocrSucceeded: true,
    suggestions: [
      { id: 'tmpl-1', brandName: 'TechnoGym', name: 'Lat Pulldown', score: 0.87 },
      { id: 'tmpl-2', brandName: 'Life Fitness', name: 'Cable Row', score: 0.55 },
    ],
  },
  status: 201,
  headers: new Headers(),
};

describe('usePhotoUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useUpload as jest.Mock).mockReturnValue(makeMockUpload());
    // Mock global fetch for blob construction from URI
    global.fetch = jest.fn().mockResolvedValue({
      blob: jest.fn().mockResolvedValue(new Blob()),
    });
  });

  it('returns correct initial state', () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePhotoUpload(GYM_MACHINE_ID, COMPRESSED_URI), {
      wrapper: Wrapper,
    });

    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadProgress).toBe(0);
    expect(result.current.uploadError).toBeNull();
    expect(result.current.result).toBeNull();
    expect(typeof result.current.upload).toBe('function');
  });

  it('sets isUploading to true when upload starts', async () => {
    // Make mutateAsync a promise that never resolves so we can observe mid-flight state
    let resolveUpload!: (v: typeof mockUploadResponse) => void;
    const pendingPromise = new Promise<typeof mockUploadResponse>((resolve) => {
      resolveUpload = resolve;
    });
    mockMutateAsync.mockReturnValue(pendingPromise);
    (useUpload as jest.Mock).mockReturnValue(makeMockUpload({ isPending: true }));

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePhotoUpload(GYM_MACHINE_ID, COMPRESSED_URI), {
      wrapper: Wrapper,
    });

    act(() => {
      void result.current.upload();
    });

    await waitFor(() => {
      expect(result.current.uploadProgress).toBeGreaterThan(0);
    });

    // Cleanup
    resolveUpload(mockUploadResponse);
  });

  it('on success: result.suggestions does NOT contain score property', async () => {
    mockMutateAsync.mockResolvedValue(mockUploadResponse);
    (useUpload as jest.Mock).mockReturnValue(makeMockUpload());

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePhotoUpload(GYM_MACHINE_ID, COMPRESSED_URI), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.upload();
    });

    await waitFor(() => {
      expect(result.current.result).not.toBeNull();
    });

    const suggestions = result.current.result?.suggestions ?? [];
    expect(suggestions.length).toBeGreaterThan(0);
    suggestions.forEach((s) => {
      expect(s).not.toHaveProperty('score');
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('brandName');
      expect(s).toHaveProperty('name');
    });
  });

  it('on success: uploadProgress is 1', async () => {
    mockMutateAsync.mockResolvedValue(mockUploadResponse);
    (useUpload as jest.Mock).mockReturnValue(makeMockUpload());

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePhotoUpload(GYM_MACHINE_ID, COMPRESSED_URI), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.upload();
    });

    await waitFor(() => {
      expect(result.current.uploadProgress).toBe(1);
    });
  });

  it('on success: result contains correct photoId, photoUrl, ocrSucceeded', async () => {
    mockMutateAsync.mockResolvedValue(mockUploadResponse);
    (useUpload as jest.Mock).mockReturnValue(makeMockUpload());

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePhotoUpload(GYM_MACHINE_ID, COMPRESSED_URI), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.upload();
    });

    await waitFor(() => {
      expect(result.current.result).not.toBeNull();
    });

    expect(result.current.result?.photoId).toBe('photo-123');
    expect(result.current.result?.photoUrl).toBe('https://cdn.example.com/photo-123.jpg');
    expect(result.current.result?.ocrSucceeded).toBe(true);
  });

  it('upload() can be called multiple times', async () => {
    mockMutateAsync.mockResolvedValue(mockUploadResponse);
    (useUpload as jest.Mock).mockReturnValue(makeMockUpload());

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePhotoUpload(GYM_MACHINE_ID, COMPRESSED_URI), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.upload();
    });

    await waitFor(() => {
      expect(result.current.result).not.toBeNull();
    });

    await act(async () => {
      await result.current.upload();
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
  });

  it('on error: uploadError is set and uploadProgress resets to 0', async () => {
    const networkError = new Error('Network failure');
    mockMutateAsync.mockRejectedValue(networkError);
    (useUpload as jest.Mock).mockReturnValue(makeMockUpload());

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePhotoUpload(GYM_MACHINE_ID, COMPRESSED_URI), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.upload();
    });

    await waitFor(() => {
      expect(result.current.uploadError).not.toBeNull();
    });

    expect(result.current.uploadError?.message).toBe('Network failure');
    expect(result.current.uploadProgress).toBe(0);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.result).toBeNull();
  });

  it('on error: non-Error thrown wraps in generic message', async () => {
    mockMutateAsync.mockRejectedValue('string-error');
    (useUpload as jest.Mock).mockReturnValue(makeMockUpload());

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePhotoUpload(GYM_MACHINE_ID, COMPRESSED_URI), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.upload();
    });

    await waitFor(() => {
      expect(result.current.uploadError).not.toBeNull();
    });

    expect(result.current.uploadError?.message).toBe('Upload failed');
  });

  it('upload() clears uploadError before re-attempting', async () => {
    const networkError = new Error('Network failure');
    mockMutateAsync.mockRejectedValueOnce(networkError).mockResolvedValueOnce(mockUploadResponse);
    (useUpload as jest.Mock).mockReturnValue(makeMockUpload());

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePhotoUpload(GYM_MACHINE_ID, COMPRESSED_URI), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.upload();
    });

    await waitFor(() => {
      expect(result.current.uploadError).not.toBeNull();
    });

    await act(async () => {
      await result.current.upload();
    });

    await waitFor(() => {
      expect(result.current.result).not.toBeNull();
    });

    expect(result.current.uploadError).toBeNull();
    expect(result.current.uploadProgress).toBe(1);
  });
});
