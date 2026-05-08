import type { CategoryResponse } from '@/shared/generated/model';
import type { Category } from '@/shared/types/database';

import { fetchCategories } from '../categories';

const mockListCategories = jest.fn();

jest.mock('@/shared/generated/categories/categories', () => ({
  listCategories: (...args: unknown[]) => mockListCategories(...args) as unknown,
}));

describe('fetchCategories', () => {
  beforeEach(() => {
    mockListCategories.mockReset();
  });

  it('calls listCategories and returns mapped Category array', async () => {
    const apiResponse: CategoryResponse[] = [
      { id: 'c1', name: 'Row' },
      { id: 'c2', name: 'Squat' },
    ];
    mockListCategories.mockResolvedValue(apiResponse);

    const result = await fetchCategories();

    expect(mockListCategories).toHaveBeenCalledTimes(1);
    const expected: Category[] = [
      { id: 'c1', name: 'Row' },
      { id: 'c2', name: 'Squat' },
    ];
    expect(result).toEqual(expected);
  });

  it('returns empty array when API returns []', async () => {
    mockListCategories.mockResolvedValue([]);

    const result = await fetchCategories();

    expect(result).toEqual([]);
  });

  it('propagates errors thrown by the API client', async () => {
    mockListCategories.mockRejectedValue(new Error('network down'));

    await expect(fetchCategories()).rejects.toThrow('network down');
  });
});
