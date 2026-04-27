import { useCallback, useState } from 'react';

import type { LoadingType, SearchFilters } from '@/shared/types/database';

export const INITIAL_FILTERS: SearchFilters = {
  brandId: null,
  categoryId: null,
  loadingType: null,
};

export function useFilters() {
  const [filters, setFilters] = useState<SearchFilters>(INITIAL_FILTERS);

  const setBrand = useCallback((brandId: string | null) => {
    setFilters((prev) => ({ ...prev, brandId }));
  }, []);

  const setCategory = useCallback((categoryId: string | null) => {
    setFilters((prev) => ({ ...prev, categoryId }));
  }, []);

  const setLoadingType = useCallback((loadingType: LoadingType | null) => {
    setFilters((prev) => ({ ...prev, loadingType }));
  }, []);

  const clear = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  return { filters, setBrand, setCategory, setLoadingType, clear };
}
