import { useQuery } from '@tanstack/react-query';

import type { MapBounds } from '@/shared/types/database';

import { mapKeys } from '../query-keys';
import { fetchTemplateCountsInBounds } from '../services/template-counts';

/**
 * Map-filter badge counts (gyms-per-template within the searched bbox). Shares
 * the gym-search staleTime so badges and gym results refresh together. Disabled
 * until a bbox exists; consumers treat a missing templateId as 0 nearby.
 */
export function useTemplateCounts(bounds: MapBounds | null) {
  return useQuery({
    queryKey: mapKeys.templateCounts(bounds),
    queryFn: () => {
      if (bounds === null) {
        throw new Error('useTemplateCounts queryFn called without bounds');
      }
      return fetchTemplateCountsInBounds(bounds);
    },
    enabled: bounds !== null,
    staleTime: 1000 * 60 * 5,
  });
}
