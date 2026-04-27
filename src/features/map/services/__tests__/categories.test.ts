import type { Category } from '@/shared/types/database';
import { mockFromOrderResult } from '@/test/utils/supabase-mocks';

import { fetchCategories } from '../categories';

const mockFrom = jest.fn();

jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args) as unknown,
  },
}));

describe('fetchCategories', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('queries the categories table with select(*) ordered by name', async () => {
    const categories: Category[] = [
      { id: 'c1', name: 'Row' },
      { id: 'c2', name: 'Squat' },
    ];
    const { select, order } = mockFromOrderResult<Category>(mockFrom, {
      data: categories,
      error: null,
    });

    const result = await fetchCategories();

    expect(mockFrom).toHaveBeenCalledWith('categories');
    expect(select).toHaveBeenCalledWith('*');
    expect(order).toHaveBeenCalledWith('name');
    expect(result).toEqual(categories);
  });

  it('throws an Error containing the supabase error message on failure', async () => {
    mockFromOrderResult<Category>(mockFrom, {
      data: null,
      error: { message: 'network down' },
    });

    await expect(fetchCategories()).rejects.toThrow('network down');
  });

  it('returns [] when supabase returns null data with no error', async () => {
    mockFromOrderResult<Category>(mockFrom, { data: null, error: null });

    const result = await fetchCategories();

    expect(result).toEqual([]);
  });
});
