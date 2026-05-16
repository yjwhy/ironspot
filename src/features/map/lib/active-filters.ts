import type { Brand, Category, LoadingType, SearchFilters } from '@/shared/types/database';

export type ActiveFilterKind = 'brand' | 'category' | 'loadingType';

export interface ActiveFilter {
  kind: ActiveFilterKind;
  id: string;
  label: string;
}

interface ToActiveFiltersInput {
  filters: SearchFilters;
  brands: readonly Brand[];
  categories: readonly Category[];
}

const LOADING_TYPE_LABEL: Record<LoadingType, string> = {
  pin: '핀로딩',
  plate: '플레이트',
};

export function toActiveFilters({
  filters,
  brands,
  categories,
}: ToActiveFiltersInput): ActiveFilter[] {
  const result: ActiveFilter[] = [];

  for (const brandId of filters.brandIds) {
    const brand = brands.find((candidate) => candidate.id === brandId);
    if (brand !== undefined) {
      result.push({ kind: 'brand', id: brand.id, label: brand.name });
    }
  }

  for (const categoryId of filters.categoryIds) {
    const category = categories.find((candidate) => candidate.id === categoryId);
    if (category !== undefined) {
      result.push({ kind: 'category', id: category.id, label: category.name });
    }
  }

  if (filters.loadingType !== null) {
    result.push({
      kind: 'loadingType',
      id: filters.loadingType,
      label: LOADING_TYPE_LABEL[filters.loadingType],
    });
  }

  return result;
}
