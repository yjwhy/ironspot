import { useQuery } from '@tanstack/react-query';

import { mapKeys } from '../query-keys';
import { fetchBrands } from '../services/brands';

export function useBrands() {
  return useQuery({
    queryKey: mapKeys.brands(),
    queryFn: fetchBrands,
    staleTime: Infinity,
  });
}
