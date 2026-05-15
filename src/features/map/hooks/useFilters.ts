import { useState } from 'react';

import type { LoadingType, SearchFilters } from '@/shared/types/database';

export const INITIAL_FILTERS: SearchFilters = {
  brandIds: [],
  categoryIds: [],
  loadingType: null,
};

export function useFilters() {
  const [filters, setFilters] = useState<SearchFilters>(INITIAL_FILTERS);

  function toggleBrand(brandId: string) {
    setFilters((prev) => ({
      ...prev,
      brandIds: prev.brandIds.includes(brandId)
        ? prev.brandIds.filter((id) => id !== brandId)
        : [...prev.brandIds, brandId],
    }));
  }

  function toggleCategory(categoryId: string) {
    setFilters((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(categoryId)
        ? prev.categoryIds.filter((id) => id !== categoryId)
        : [...prev.categoryIds, categoryId],
    }));
  }

  function setLoadingType(loadingType: LoadingType | null) {
    setFilters((prev) => ({ ...prev, loadingType }));
  }

  function setAll(next: SearchFilters) {
    setFilters(next);
  }

  function clear() {
    setFilters(INITIAL_FILTERS);
  }

  return { filters, toggleBrand, toggleCategory, setLoadingType, setAll, clear };
}
