import type { Brand } from '@/shared/types/database';

import { fetchBrands } from '../brands';

const mockFrom = jest.fn();

jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args) as unknown,
  },
}));

interface OrderResult {
  data: Brand[] | null;
  error: { message: string } | null;
}

function mockFromOrderResult(result: OrderResult) {
  const order = jest.fn().mockResolvedValue(result);
  const select = jest.fn().mockReturnValue({ order });
  mockFrom.mockReturnValue({ select });
  return { select, order };
}

describe('fetchBrands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries the brands table with select(*) ordered by name', async () => {
    const brands: Brand[] = [
      { id: 'b1', name: 'Panatta' },
      { id: 'b2', name: 'Technogym' },
    ];
    const { select, order } = mockFromOrderResult({ data: brands, error: null });

    const result = await fetchBrands();

    expect(mockFrom).toHaveBeenCalledWith('brands');
    expect(select).toHaveBeenCalledWith('*');
    expect(order).toHaveBeenCalledWith('name');
    expect(result).toEqual(brands);
  });

  it('throws an Error containing the supabase error message on failure', async () => {
    mockFromOrderResult({ data: null, error: { message: 'permission denied' } });

    await expect(fetchBrands()).rejects.toThrow('permission denied');
  });

  it('returns [] when supabase returns null data with no error', async () => {
    mockFromOrderResult({ data: null, error: null });

    const result = await fetchBrands();

    expect(result).toEqual([]);
  });
});
