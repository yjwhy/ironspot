import type { BrandResponse } from '@/shared/generated/model';
import type { Brand } from '@/shared/types/database';

import { fetchBrands } from '../brands';

const mockListBrands = jest.fn();

jest.mock('@/shared/generated/brands/brands', () => ({
  listBrands: (...args: unknown[]) => mockListBrands(...args) as unknown,
}));

describe('fetchBrands', () => {
  beforeEach(() => {
    mockListBrands.mockReset();
  });

  it('calls listBrands and returns mapped Brand array', async () => {
    const apiResponse: BrandResponse[] = [
      { id: 'b1', name: 'Panatta' },
      { id: 'b2', name: 'Technogym' },
    ];
    mockListBrands.mockResolvedValue(apiResponse);

    const result = await fetchBrands();

    expect(mockListBrands).toHaveBeenCalledTimes(1);
    const expected: Brand[] = [
      { id: 'b1', name: 'Panatta' },
      { id: 'b2', name: 'Technogym' },
    ];
    expect(result).toEqual(expected);
  });

  it('returns empty array when API returns []', async () => {
    mockListBrands.mockResolvedValue([]);

    const result = await fetchBrands();

    expect(result).toEqual([]);
  });

  it('propagates errors thrown by the API client', async () => {
    mockListBrands.mockRejectedValue(new Error('network error'));

    await expect(fetchBrands()).rejects.toThrow('network error');
  });
});
