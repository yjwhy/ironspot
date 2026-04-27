import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Category } from '@/shared/types/database';

import { fetchCategories } from '../../services/categories';
import { useCategories } from '../useCategories';

jest.mock('../../services/categories', () => ({
  fetchCategories: jest.fn(),
}));

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe('useCategories', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls fetchCategories and returns the data on success', async () => {
    const categories: Category[] = [
      { id: 'c1', name: 'Row' },
      { id: 'c2', name: 'Squat' },
    ];
    const mockFetch = fetchCategories as jest.MockedFunction<typeof fetchCategories>;
    mockFetch.mockResolvedValue(categories);

    const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(categories);
  });

  it('exposes an error state when the service throws', async () => {
    const mockFetch = fetchCategories as jest.MockedFunction<typeof fetchCategories>;
    mockFetch.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useCategories(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
