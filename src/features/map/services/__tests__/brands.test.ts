import type { Brand } from '@/shared/types/database';
import { mockFromOrderResult } from '@/test/utils/supabase-mocks';

import { fetchBrands } from '../brands';

const mockFrom = jest.fn();

jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args) as unknown,
  },
}));

describe('fetchBrands', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('queries the brands table with select(*) ordered by name', async () => {
    const brands: Brand[] = [
      { id: 'b1', name: 'Panatta' },
      { id: 'b2', name: 'Technogym' },
    ];
    const { select, order } = mockFromOrderResult<Brand>(mockFrom, {
      data: brands,
      error: null,
    });

    const result = await fetchBrands();

    expect(mockFrom).toHaveBeenCalledWith('brands');
    expect(select).toHaveBeenCalledWith('*');
    expect(order).toHaveBeenCalledWith('name');
    expect(result).toEqual(brands);
  });

  it('throws an Error containing the supabase error message on failure', async () => {
    mockFromOrderResult<Brand>(mockFrom, {
      data: null,
      error: { message: 'permission denied' },
    });

    await expect(fetchBrands()).rejects.toThrow('permission denied');
  });

  it('returns [] when supabase returns null data with no error', async () => {
    mockFromOrderResult<Brand>(mockFrom, { data: null, error: null });

    const result = await fetchBrands();

    expect(result).toEqual([]);
  });
});
