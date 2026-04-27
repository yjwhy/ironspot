import { renderHook, waitFor } from '@testing-library/react-native';

import type { Brand } from '@/shared/types/database';
import { createQueryWrapper } from '@/test/utils/query-wrapper';

import { fetchBrands } from '../../services/brands';
import { useBrands } from '../useBrands';

jest.mock('../../services/brands', () => ({
  fetchBrands: jest.fn(),
}));

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
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useBrands(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(brands);
  });

  it('exposes an error state when the service throws', async () => {
    const mockFetch = fetchBrands as jest.MockedFunction<typeof fetchBrands>;
    mockFetch.mockRejectedValue(new Error('boom'));
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useBrands(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
