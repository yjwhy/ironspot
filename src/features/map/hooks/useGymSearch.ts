import { useQuery } from '@tanstack/react-query';

import type { MapBounds, SearchFilters } from '@/shared/types/database';

import { mapKeys } from '../query-keys';
import { searchGymsInBounds } from '../services/gym-search';

export function useGymSearch(bounds: MapBounds | null, filters: SearchFilters) {
  return useQuery({
    queryKey: mapKeys.gymSearch(bounds, filters),
    queryFn: () => {
      if (bounds === null) {
        throw new Error('useGymSearch queryFn called without bounds');
      }
      return searchGymsInBounds(bounds, filters);
    },
    enabled: bounds !== null,
    staleTime: 1000 * 60 * 5,
  });
}
