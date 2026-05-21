import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import * as burnt from 'burnt';
import type { ReactNode } from 'react';

import { useReject } from '@/shared/generated/admin-contributions/admin-contributions';

import { adminKeys } from '../../query-keys';
import { useRejectContribution } from '../useRejectContribution';

jest.mock('@/shared/generated/admin-contributions/admin-contributions', () => ({
  useReject: jest.fn(),
}));
jest.mock('burnt', () => ({ toast: jest.fn() }));

const useRejectMock = useReject as jest.Mock;

interface CapturedOptions {
  mutation?: {
    onSuccess?: () => void;
    onError?: () => void;
  };
}

function setupMutation() {
  const mutate = jest.fn();
  let captured: CapturedOptions | undefined;
  useRejectMock.mockImplementation((options: CapturedOptions) => {
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

describe('useRejectContribution', () => {
  it('mutates with the gymMachineId', () => {
    const { mutate } = setupMutation();
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useRejectContribution('gm-1'), { wrapper: Wrapper });

    act(() => {
      result.current.handleReject();
    });

    expect(mutate).toHaveBeenCalledWith({ id: 'gm-1' });
  });

  it('shows a success toast and invalidates the pending contributions cache', () => {
    const { getOptions } = setupMutation();
    const { Wrapper, client } = makeWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    renderHook(() => useRejectContribution('gm-1'), { wrapper: Wrapper });

    act(() => {
      getOptions()?.mutation?.onSuccess?.();
    });

    expect(burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '반려했어요', preset: 'done' }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminKeys.pendingContributions(),
    });
  });

  it('surfaces an error toast on failure', () => {
    const { getOptions } = setupMutation();
    const { Wrapper } = makeWrapper();
    renderHook(() => useRejectContribution('gm-1'), { wrapper: Wrapper });

    act(() => {
      getOptions()?.mutation?.onError?.();
    });

    expect(burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '반려에 실패했어요', preset: 'error' }),
    );
  });
});
