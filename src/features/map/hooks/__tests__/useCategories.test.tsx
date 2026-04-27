import { renderHook, waitFor } from '@testing-library/react-native';

import type { Category } from '@/shared/types/database';
import { createQueryWrapper } from '@/test/utils/query-wrapper';

import { fetchCategories } from '../../services/categories';
import { useCategories } from '../useCategories';

jest.mock('../../services/categories', () => ({
  fetchCategories: jest.fn(),
}));

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
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useCategories(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(categories);
  });

  it('exposes an error state when the service throws', async () => {
    const mockFetch = fetchCategories as jest.MockedFunction<typeof fetchCategories>;
    mockFetch.mockRejectedValue(new Error('boom'));
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useCategories(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
