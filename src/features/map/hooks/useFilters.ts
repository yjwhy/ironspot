import { useState } from 'react';

import type { LoadingType, SearchFilters } from '@/shared/types/database';

export const INITIAL_FILTERS: SearchFilters = {
  brandId: null,
  categoryId: null,
  loadingType: null,
};

export function useFilters() {
  const [filters, setFilters] = useState<SearchFilters>(INITIAL_FILTERS);

  function setBrand(brandId: string | null) {
    setFilters((prev) => ({ ...prev, brandId }));
  }

  function setCategory(categoryId: string | null) {
    setFilters((prev) => ({ ...prev, categoryId }));
  }

  function setLoadingType(loadingType: LoadingType | null) {
    setFilters((prev) => ({ ...prev, loadingType }));
  }

  function clear() {
    setFilters(INITIAL_FILTERS);
  }

  return { filters, setBrand, setCategory, setLoadingType, clear };
}
