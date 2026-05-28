import { useQuery } from '@tanstack/react-query';

import type { SeriesResponse } from '@/shared/generated/model';

import { mapKeys } from '../query-keys';
import { fetchSeries } from '../services/series';

/**
 * V27 / machine_series: brand product-line catalog. Backs the unified
 * brand-or-series picker entry on the manual-input flow, mirroring
 * {@link useBrands}. Catalog is closed and small (~74 rows at launch)
 * so we fetch the full list once and narrow with offline fuzzy.
 */
export function useSeries() {
  return useQuery<readonly SeriesResponse[]>({
    queryKey: mapKeys.series(),
    queryFn: fetchSeries,
    staleTime: Infinity,
  });
}
