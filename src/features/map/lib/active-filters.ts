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

export const LOADING_TYPE_LABEL: Record<LoadingType, string> = {
  pin: '핀로딩',
  plate: '플레이트',
};

// Korean prefix used by ActiveFilterStrip accessibility labels
// (e.g. "브랜드 Panatta 필터 제거"). Kept here so the view-model layer owns
// every user-visible label that depends on `ActiveFilterKind`.
export const ACTIVE_FILTER_KIND_LABEL: Record<ActiveFilterKind, string> = {
  brand: '브랜드',
  category: '머신 종류',
  loadingType: '로딩 방식',
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
