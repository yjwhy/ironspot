import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as burnt from 'burnt';
import type { ReactNode } from 'react';

import { useRequireAuth } from '@/features/auth/hooks/useRequireAuth';
import { removeUpvotePhoto, upvotePhoto } from '@/shared/generated/votes/votes';
import type { MachinePhoto } from '@/shared/types/database';
import { makeMachinePhoto } from '@/test/utils/factories/gym-machine';

import { photoKeys } from '../../query-keys';
import { useUpvote } from '../useUpvote';

// Local wrapper with gcTime > 0; the shared createQueryWrapper uses gcTime: 0,
// which causes cancelQueries() (inside onMutate) to GC inactive queries before
// the optimistic setQueryData runs.
const TEST_GC_TIME_MS = 60_000;

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: TEST_GC_TIME_MS },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { Wrapper, client };
}

jest.mock('@/features/auth/hooks/useRequireAuth', () => ({
  useRequireAuth: jest.fn(),
}));

jest.mock('@/shared/generated/votes/votes', () => ({
  upvotePhoto: jest.fn(),
  removeUpvotePhoto: jest.fn(),
}));

jest.mock('burnt', () => ({
  toast: jest.fn(),
}));

const PHOTO_ID = 'photo-abc';
const MACHINE_ID = 'gm-1';

function makePhoto(overrides: Parameters<typeof makeMachinePhoto>[0] = {}) {
  return makeMachinePhoto({
    id: PHOTO_ID,
    gym_machine_id: MACHINE_ID,
    upvote_count: 3,
    ...overrides,
  });
}

interface Deferred {
  promise: Promise<undefined>;
  resolve: () => void;
  reject: (reason: unknown) => void;
}

/** Returns a pending promise and its resolve/reject handles. */
function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<undefined>((res, rej) => {
    resolve = () => {
      res(undefined);
    };
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useUpvote', () => {
  const mockUpvote = upvotePhoto as jest.MockedFunction<typeof upvotePhoto>;
  const mockRemove = removeUpvotePhoto as jest.MockedFunction<typeof removeUpvotePhoto>;
  const mockBurntToast = burnt.toast as jest.MockedFunction<typeof burnt.toast>;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRequireAuth as jest.Mock).mockReturnValue((action: () => void) => {
      action();
    });
  });

  it('returns isUpvotedByMe derived from photo.is_upvoted_by_me', () => {
    const { Wrapper } = createWrapper();
    const photo = makePhoto({ is_upvoted_by_me: true });
    const { result } = renderHook(() => useUpvote(photo), { wrapper: Wrapper });

    expect(result.current.isUpvotedByMe).toBe(true);
  });

  it('defaults isUpvotedByMe to false when field is absent', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpvote(makePhoto()), { wrapper: Wrapper });

    expect(result.current.isUpvotedByMe).toBe(false);
  });

  it('calls upvotePhoto and optimistically increments upvote_count when not yet voted', async () => {
    const { promise, resolve } = deferred();
    mockUpvote.mockReturnValue(promise as never);

    const { Wrapper, client } = createWrapper();
    const photo = makePhoto();
    client.setQueryData(photoKeys.list(MACHINE_ID), [photo]);

    const { result } = renderHook(() => useUpvote(photo), { wrapper: Wrapper });

    act(() => {
      result.current.handleUpvote();
    });

    // onMutate may complete in a microtask after act resolves; poll until applied
    await waitFor(() => {
      const cached = client.getQueryData<MachinePhoto[]>(photoKeys.list(MACHINE_ID));
      expect(cached?.[0]?.upvote_count).toBe(4);
      expect(cached?.[0]?.is_upvoted_by_me).toBe(true);
    });

    resolve();
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(mockUpvote).toHaveBeenCalledWith(PHOTO_ID);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('calls removeUpvotePhoto and optimistically decrements when already voted', async () => {
    const { promise, resolve } = deferred();
    mockRemove.mockReturnValue(promise as never);

    const { Wrapper, client } = createWrapper();
    const photo = makePhoto({ is_upvoted_by_me: true });
    client.setQueryData(photoKeys.list(MACHINE_ID), [photo]);

    const { result } = renderHook(() => useUpvote(photo), { wrapper: Wrapper });

    act(() => {
      result.current.handleUpvote();
    });

    await waitFor(() => {
      const cached = client.getQueryData<MachinePhoto[]>(photoKeys.list(MACHINE_ID));
      expect(cached?.[0]?.upvote_count).toBe(2);
      expect(cached?.[0]?.is_upvoted_by_me).toBe(false);
    });

    resolve();
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(mockRemove).toHaveBeenCalledWith(PHOTO_ID);
    expect(mockUpvote).not.toHaveBeenCalled();
  });

  it('rolls back cache on upvote error and shows toast', async () => {
    const { promise, reject } = deferred();
    mockUpvote.mockReturnValue(promise as never);

    const { Wrapper, client } = createWrapper();
    const photo = makePhoto();
    client.setQueryData(photoKeys.list(MACHINE_ID), [photo]);

    const { result } = renderHook(() => useUpvote(photo), { wrapper: Wrapper });

    act(() => {
      result.current.handleUpvote();
    });

    // Wait for optimistic update to be applied
    await waitFor(() => {
      const optimistic = client.getQueryData<MachinePhoto[]>(photoKeys.list(MACHINE_ID));
      expect(optimistic?.[0]?.upvote_count).toBe(4);
    });

    // Reject mutation to trigger rollback
    reject(new Error('server error'));
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    await waitFor(() => {
      const rolledBack = client.getQueryData<MachinePhoto[]>(photoKeys.list(MACHINE_ID));
      expect(rolledBack?.[0]?.upvote_count).toBe(3);
      expect(rolledBack?.[0]?.is_upvoted_by_me).toBeFalsy();
    });
    expect(mockBurntToast).toHaveBeenCalledWith(expect.objectContaining({ preset: 'error' }));
  });

  it('gates action behind requireAuth', () => {
    const mockRequireAuth = jest.fn();
    (useRequireAuth as jest.Mock).mockReturnValue(mockRequireAuth);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useUpvote(makePhoto()), { wrapper: Wrapper });

    act(() => {
      result.current.handleUpvote();
    });

    expect(mockRequireAuth).toHaveBeenCalledTimes(1);
    expect(mockUpvote).not.toHaveBeenCalled();
  });

  it('reads vote state from cache so a quick second tap does not double-toggle', async () => {
    const upvoteDeferred = deferred();
    mockUpvote.mockReturnValue(upvoteDeferred.promise as never);

    const { Wrapper, client } = createWrapper();
    const photo = makePhoto(); // is_upvoted_by_me undefined → false initially
    client.setQueryData(photoKeys.list(MACHINE_ID), [photo]);

    const { result } = renderHook(() => useUpvote(photo), { wrapper: Wrapper });

    // First tap: upvote
    act(() => {
      result.current.handleUpvote();
    });
    await waitFor(() => {
      const cached = client.getQueryData<MachinePhoto[]>(photoKeys.list(MACHINE_ID));
      expect(cached?.[0]?.is_upvoted_by_me).toBe(true);
    });
    upvoteDeferred.resolve();
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    // Second tap: hook still has stale photo prop (is_upvoted_by_me undefined),
    // but cache says true. Should call removeUpvotePhoto, not upvotePhoto again.
    const removeDeferred = deferred();
    mockRemove.mockReturnValue(removeDeferred.promise as never);
    act(() => {
      result.current.handleUpvote();
    });
    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith(PHOTO_ID);
    });
    expect(mockUpvote).toHaveBeenCalledTimes(1); // not called again
    removeDeferred.resolve();
  });
});
