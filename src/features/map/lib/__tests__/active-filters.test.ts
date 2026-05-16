import type { Brand, Category, SearchFilters } from '@/shared/types/database';

import { toActiveFilters } from '../active-filters';

const brands: Brand[] = [
  { id: 'b1', name: 'Panatta' },
  { id: 'b2', name: 'Hammer Strength' },
];

const categories: Category[] = [
  { id: 'c1', name: '등' },
  { id: 'c2', name: '가슴' },
];

const emptyFilters: SearchFilters = {
  brandIds: [],
  categoryIds: [],
  loadingType: null,
};

describe('toActiveFilters', () => {
  it('returns an empty array when no filter is active', () => {
    expect(toActiveFilters({ filters: emptyFilters, brands, categories })).toEqual([]);
  });

  it('maps brand ids to brand names preserving selection order', () => {
    const result = toActiveFilters({
      filters: { ...emptyFilters, brandIds: ['b2', 'b1'] },
      brands,
      categories,
    });
    expect(result).toEqual([
      { kind: 'brand', id: 'b2', label: 'Hammer Strength' },
      { kind: 'brand', id: 'b1', label: 'Panatta' },
    ]);
  });

  it('maps category ids to category names', () => {
    const result = toActiveFilters({
      filters: { ...emptyFilters, categoryIds: ['c1', 'c2'] },
      brands,
      categories,
    });
    expect(result).toEqual([
      { kind: 'category', id: 'c1', label: '등' },
      { kind: 'category', id: 'c2', label: '가슴' },
    ]);
  });

  it('skips brand ids that do not resolve to a known brand', () => {
    const result = toActiveFilters({
      filters: { ...emptyFilters, brandIds: ['b1', 'unknown'] },
      brands,
      categories,
    });
    expect(result).toEqual([{ kind: 'brand', id: 'b1', label: 'Panatta' }]);
  });

  it('emits a loadingType entry with Korean label when set to pin', () => {
    const result = toActiveFilters({
      filters: { ...emptyFilters, loadingType: 'pin' },
      brands,
      categories,
    });
    expect(result).toEqual([{ kind: 'loadingType', id: 'pin', label: '핀로딩' }]);
  });

  it('emits a loadingType entry with Korean label when set to plate', () => {
    const result = toActiveFilters({
      filters: { ...emptyFilters, loadingType: 'plate' },
      brands,
      categories,
    });
    expect(result).toEqual([{ kind: 'loadingType', id: 'plate', label: '플레이트' }]);
  });

  it('combines brand, category, and loadingType in order brand → category → loadingType', () => {
    const result = toActiveFilters({
      filters: { brandIds: ['b1'], categoryIds: ['c2'], loadingType: 'plate' },
      brands,
      categories,
    });
    expect(result).toEqual([
      { kind: 'brand', id: 'b1', label: 'Panatta' },
      { kind: 'category', id: 'c2', label: '가슴' },
      { kind: 'loadingType', id: 'plate', label: '플레이트' },
    ]);
  });
});
