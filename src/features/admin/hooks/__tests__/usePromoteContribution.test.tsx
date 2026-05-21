import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import * as burnt from 'burnt';
import type { ReactNode } from 'react';

import { usePromote } from '@/shared/generated/admin-contributions/admin-contributions';

import { adminKeys } from '../../query-keys';
import { usePromoteContribution } from '../usePromoteContribution';

jest.mock('@/shared/generated/admin-contributions/admin-contributions', () => ({
  usePromote: jest.fn(),
}));
jest.mock('burnt', () => ({ toast: jest.fn() }));

const usePromoteMock = usePromote as jest.Mock;

interface CapturedOptions {
  mutation?: {
    onSuccess?: (response: { data: { mergedIntoGymMachineId?: string } }) => void;
    onError?: () => void;
  };
}

function setupMutation() {
  const mutate = jest.fn();
  let captured: CapturedOptions | undefined;
  usePromoteMock.mockImplementation((options: CapturedOptions) => {
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

describe('usePromoteContribution', () => {
  it('mutates with the gymMachineId and the supplied request body', () => {
    const { mutate } = setupMutation();
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => usePromoteContribution('gm-1'), { wrapper: Wrapper });

    act(() => {
      result.current.handlePromote({ kind: 'existingTemplate', templateId: 't-1' });
    });

    expect(mutate).toHaveBeenCalledWith({
      id: 'gm-1',
      data: { kind: 'existingTemplate', templateId: 't-1' },
    });
  });

  it('shows the "promoted" toast and invalidates caches on a non-merge success', () => {
    const { getOptions } = setupMutation();
    const { Wrapper, client } = makeWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    renderHook(() => usePromoteContribution('gm-1'), { wrapper: Wrapper });

    act(() => {
      getOptions()?.mutation?.onSuccess?.({ data: { mergedIntoGymMachineId: undefined } });
    });

    expect(burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '머신을 승격했어요', preset: 'done' }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: adminKeys.pendingContributions(),
    });
  });

  it('shows the "merged" toast when the response carries mergedIntoGymMachineId', () => {
    const { getOptions } = setupMutation();
    const { Wrapper } = makeWrapper();
    renderHook(() => usePromoteContribution('gm-1'), { wrapper: Wrapper });

    act(() => {
      getOptions()?.mutation?.onSuccess?.({ data: { mergedIntoGymMachineId: 'gm-existing' } });
    });

    expect(burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '기존 머신과 합쳤어요' }),
    );
  });

  it('shows an error toast on failure', () => {
    const { getOptions } = setupMutation();
    const { Wrapper } = makeWrapper();
    renderHook(() => usePromoteContribution('gm-1'), { wrapper: Wrapper });

    act(() => {
      getOptions()?.mutation?.onError?.();
    });

    expect(burnt.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '승격에 실패했어요', preset: 'error' }),
    );
  });
});
