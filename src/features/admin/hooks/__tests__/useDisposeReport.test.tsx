import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useDisposition } from '@/shared/generated/admin/admin';

import { adminKeys } from '../../query-keys';
import { useDisposeReport } from '../useDisposeReport';

jest.mock('@/shared/generated/admin/admin', () => ({ useDisposition: jest.fn() }));
jest.mock('burnt', () => ({ toast: jest.fn() }));

const useDispositionMock = useDisposition as jest.Mock;

interface CapturedOptions {
  mutation?: {
    onSuccess?: (data: unknown, variables: { id: string; data: { disposition: string } }) => void;
    onError?: (err: unknown) => void;
  };
}

function setupMutation() {
  const mutate = jest.fn();
  let captured: CapturedOptions | undefined;
  useDispositionMock.mockImplementation((options: CapturedOptions) => {
    captured = options;
    return { mutate, isPending: false };
  });
  return { mutate, getOptions: () => captured };
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { Wrapper, client };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useDisposeReport', () => {
  it('dispatches useDisposition.mutate with the supplied reportId and disposition', () => {
    const { mutate } = setupMutation();
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useDisposeReport('r-1', 'p-1'), { wrapper: Wrapper });

    act(() => {
      result.current.handleDispose('actioned');
    });

    expect(mutate).toHaveBeenCalledWith({ id: 'r-1', data: { disposition: 'actioned' } });
  });

  it('invalidates the pending queue and photo detail caches on success', () => {
    const { getOptions } = setupMutation();
    const { Wrapper, client } = makeWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    renderHook(() => useDisposeReport('r-1', 'p-1'), { wrapper: Wrapper });

    act(() => {
      getOptions()?.mutation?.onSuccess?.(undefined, {
        id: 'r-1',
        data: { disposition: 'actioned' },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminKeys.pendingPhotos() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: adminKeys.photoDetail('p-1') });
  });
});
