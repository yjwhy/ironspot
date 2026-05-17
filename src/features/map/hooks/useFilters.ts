import { useState } from 'react';

import type { SearchFilters } from '@/shared/types/database';

export const INITIAL_FILTERS: SearchFilters = {
  brandIds: [],
  categoryIds: [],
  templateIds: [],
  machineFilterMode: 'or',
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

  // ADR 0022: machine templates are multi-select with optional AND mode.
  function toggleTemplate(templateId: string) {
    setFilters((prev) => ({
      ...prev,
      templateIds: prev.templateIds.includes(templateId)
        ? prev.templateIds.filter((id) => id !== templateId)
        : [...prev.templateIds, templateId],
    }));
  }

  function setMachineFilterMode(mode: SearchFilters['machineFilterMode']) {
    setFilters((prev) => ({ ...prev, machineFilterMode: mode }));
  }

  function setAll(next: SearchFilters) {
    setFilters(next);
  }

  function clear() {
    setFilters(INITIAL_FILTERS);
  }

  return {
    filters,
    toggleBrand,
    toggleCategory,
    toggleTemplate,
    setMachineFilterMode,
    setAll,
    clear,
  };
}
