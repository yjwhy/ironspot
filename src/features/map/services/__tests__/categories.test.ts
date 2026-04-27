import type { Category } from '@/shared/types/database';

import { fetchCategories } from '../categories';

const mockFrom = jest.fn();

jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args) as unknown,
  },
}));

interface OrderResult {
  data: Category[] | null;
  error: { message: string } | null;
}

function mockFromOrderResult(result: OrderResult) {
  const order = jest.fn().mockResolvedValue(result);
  const select = jest.fn().mockReturnValue({ order });
  mockFrom.mockReturnValue({ select });
  return { select, order };
}

describe('fetchCategories', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries the categories table with select(*) ordered by name', async () => {
    const categories: Category[] = [
      { id: 'c1', name: 'Row' },
      { id: 'c2', name: 'Squat' },
    ];
    const { select, order } = mockFromOrderResult({ data: categories, error: null });

    const result = await fetchCategories();

    expect(mockFrom).toHaveBeenCalledWith('categories');
    expect(select).toHaveBeenCalledWith('*');
    expect(order).toHaveBeenCalledWith('name');
    expect(result).toEqual(categories);
  });

  it('throws an Error containing the supabase error message on failure', async () => {
    mockFromOrderResult({ data: null, error: { message: 'network down' } });

    await expect(fetchCategories()).rejects.toThrow('network down');
  });

  it('returns [] when supabase returns null data with no error', async () => {
    mockFromOrderResult({ data: null, error: null });

    const result = await fetchCategories();

    expect(result).toEqual([]);
  });
});
