import type { MapBounds, SearchFilters } from '@/shared/types/database';

export const mapKeys = {
  all: ['map'] as const,
  brands: () => [...mapKeys.all, 'brands'] as const,
  categories: () => [...mapKeys.all, 'categories'] as const,
  gymSearch: (bounds: MapBounds | null, filters: SearchFilters) =>
    [...mapKeys.all, 'search', bounds, filters] as const,
};
