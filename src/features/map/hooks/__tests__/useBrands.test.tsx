import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Brand } from '@/shared/types/database';

import { fetchBrands } from '../../services/brands';
import { useBrands } from '../useBrands';

jest.mock('../../services/brands', () => ({
  fetchBrands: jest.fn(),
}));

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe('useBrands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls fetchBrands and returns the data on success', async () => {
    const brands: Brand[] = [
      { id: 'b1', name: 'Panatta' },
      { id: 'b2', name: 'Technogym' },
    ];
    const mockFetch = fetchBrands as jest.MockedFunction<typeof fetchBrands>;
    mockFetch.mockResolvedValue(brands);

    const { result } = renderHook(() => useBrands(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(brands);
  });

  it('exposes an error state when the service throws', async () => {
    const mockFetch = fetchBrands as jest.MockedFunction<typeof fetchBrands>;
    mockFetch.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useBrands(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
