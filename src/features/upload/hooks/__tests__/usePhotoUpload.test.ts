import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { PhotoUploadResponse } from '@/shared/generated/model';
import { useUpload } from '@/shared/generated/photos/photos';
import { HTTPError } from '@/shared/lib/api-client';
import { createQueryWrapper } from '@/test/utils/query-wrapper';

import { PHOTO_FILENAME, PHOTO_MIME_TYPE } from '../../constants';
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
const COMPRESSED_URI = 'file:///tmp/compressed.webp';

// apiClient returns the bare response body at runtime (see src/shared/lib/orval-response.ts);
// the Orval envelope type `{ data, status, headers }` is a compile-time fiction. The mock
// here matches the real runtime shape so the hook + unwrapOrvalResponse pipeline is
// exercised against what production actually returns.
const mockUploadResponse: PhotoUploadResponse = {
  photoId: 'photo-123',
  photoUrl: 'https://cdn.example.com/photo-123.jpg',
  ocrSucceeded: true,
  suggestions: [
    {
      id: 'tmpl-1',
      brandName: 'TechnoGym',
      nameEn: 'Lat Pulldown',
      nameKo: '랫 풀다운',
      score: 0.87,
    },
    {
      id: 'tmpl-2',
      brandName: 'Life Fitness',
      nameEn: 'Cable Row',
      nameKo: '케이블 로우',
      score: 0.55,
    },
  ],
};

describe('usePhotoUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useUpload as jest.Mock).mockReturnValue(makeMockUpload());
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
      expect(s).toHaveProperty('nameEn');
      expect(s).toHaveProperty('nameKo');
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

    expect(result.current.uploadError).toEqual({ kind: 'generic', error: networkError });
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

    const err = result.current.uploadError;
    expect(err?.kind).toBe('generic');
    if (err?.kind === 'generic') {
      expect(err.error.message).toBe('Upload failed');
    }
  });

  it('on 429 HTTPError: uploadError is classified as quota and retry is not invited', async () => {
    // Phase 5 item 11 slice (d): orphan quota 429 should set uploadError to
    // { kind: 'quota' } so UploadErrorView can render quota-specific copy
    // and hide the retry CTA (retrying against a quota wall is a no-op).
    // Construct via the prototype directly instead of `new HTTPError(...)` so
    // the test doesn't depend on ky's internal constructor signature. The
    // hook narrows by `instanceof HTTPError && response.status === 429`, so
    // those two surface fields are all it needs.
    const httpError: HTTPError = Object.assign(Object.create(HTTPError.prototype) as HTTPError, {
      response: { status: 429 } as Response,
      message: 'Quota exceeded',
    });

    mockMutateAsync.mockRejectedValue(httpError);
    (useUpload as jest.Mock).mockReturnValue(makeMockUpload());

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePhotoUpload(undefined, COMPRESSED_URI), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.upload();
    });

    await waitFor(() => {
      expect(result.current.uploadError).not.toBeNull();
    });

    expect(result.current.uploadError).toEqual({ kind: 'quota' });
  });

  it('sends RN file descriptor (uri + name + type) instead of a typeless Blob', async () => {
    // Regression guard for Phase 5 item 12: fetch(file://).blob() drops the MIME on iOS,
    // which made the backend's content-type validator reject the upload before OCR ran.
    // The hook must pass `{ uri, name, type: 'image/webp' }` so RN's multipart writer
    // sets the correct part Content-Type and filename.
    mockMutateAsync.mockResolvedValue(mockUploadResponse);
    (useUpload as jest.Mock).mockReturnValue(makeMockUpload());

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePhotoUpload(GYM_MACHINE_ID, COMPRESSED_URI), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.upload();
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    interface UploadCallArg {
      params: { gymMachineId: string };
      data: { image: { uri: string; name: string; type: string } };
    }
    const calls = mockMutateAsync.mock.calls as [UploadCallArg][];
    expect(calls[0]?.[0].params.gymMachineId).toBe(GYM_MACHINE_ID);
    expect(calls[0]?.[0].data.image.uri).toBe(COMPRESSED_URI);
    expect(calls[0]?.[0].data.image.type).toBe(PHOTO_MIME_TYPE);
    expect(calls[0]?.[0].data.image.name).toBe(PHOTO_FILENAME);
  });

  it('omits gymMachineId from params when undefined (orphan upload)', async () => {
    // Phase 5 item 11 slice 2: OCR confirm screen uploads without a
    // gym_machine_id; the contribution endpoint binds the photo afterwards.
    // The mutation params object must not carry gymMachineId so Orval's URL
    // builder skips it and the request lands as `/api/photos/upload`.
    mockMutateAsync.mockResolvedValue(mockUploadResponse);
    (useUpload as jest.Mock).mockReturnValue(makeMockUpload());

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePhotoUpload(undefined, COMPRESSED_URI), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.upload();
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    interface UploadCallArg {
      params: { gymMachineId?: string };
    }
    const calls = mockMutateAsync.mock.calls as [UploadCallArg][];
    expect(calls[0]?.[0].params.gymMachineId).toBeUndefined();
    expect(Object.keys(calls[0]?.[0].params ?? {})).not.toContain('gymMachineId');
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
