import type { MapBounds, SearchFilters } from '@/shared/types/database';

export const mapKeys = {
  all: ['map'] as const,
  brands: () => [...mapKeys.all, 'brands'] as const,
  series: () => [...mapKeys.all, 'series'] as const,
  categories: () => [...mapKeys.all, 'categories'] as const,
  machineTemplates: (params?: { brandId?: string; categoryId?: string; seriesId?: string }) =>
    [
      ...mapKeys.all,
      'machine-templates',
      params?.brandId ?? null,
      params?.categoryId ?? null,
      params?.seriesId ?? null,
    ] as const,
  gymSearch: (bounds: MapBounds | null, filters: SearchFilters) =>
    [...mapKeys.all, 'search', bounds, filters] as const,
  templateCounts: (bounds: MapBounds | null) =>
    [...mapKeys.all, 'template-counts', bounds] as const,
};
