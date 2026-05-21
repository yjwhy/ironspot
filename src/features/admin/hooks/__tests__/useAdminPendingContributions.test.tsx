import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { listPending } from '@/shared/generated/admin-contributions/admin-contributions';

import { useAdminPendingContributions } from '../useAdminPendingContributions';

jest.mock('@/shared/generated/admin-contributions/admin-contributions', () => ({
  listPending: jest.fn(),
}));

const listPendingMock = listPending as jest.Mock;

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { Wrapper };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAdminPendingContributions', () => {
  it('returns the unwrapped list when the request succeeds', async () => {
    // apiClient resolves with the raw body; unwrapOrvalResponse is a runtime
    // identity. The mock therefore returns the array directly, matching what
    // production callers see.
    listPendingMock.mockResolvedValue([
      {
        gymMachineId: 'gm-1',
        gymId: 'g-1',
        gymName: '바벨짐',
        freeFormName: '커스텀 머신',
        createdAt: '2026-05-22T01:00:00Z',
      },
    ]);
    const { Wrapper } = makeWrapper();

    const { result } = renderHook(() => useAdminPendingContributions(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].freeFormName).toBe('커스텀 머신');
  });

  it('passes the limit param through to the generated client', async () => {
    listPendingMock.mockResolvedValue([]);
    const { Wrapper } = makeWrapper();

    renderHook(() => useAdminPendingContributions(20), { wrapper: Wrapper });

    await waitFor(() => {
      expect(listPendingMock).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
    });
  });

  it('surfaces an error result when the request fails', async () => {
    listPendingMock.mockRejectedValue(new Error('boom'));
    const { Wrapper } = makeWrapper();

    const { result } = renderHook(() => useAdminPendingContributions(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
