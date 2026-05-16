import { useQuery } from '@tanstack/react-query';

import type { Brand } from '@/shared/types/database';

import { mapKeys } from '../query-keys';
import { fetchBrands } from '../services/brands';

function sortByNameKo(items: readonly Brand[]): Brand[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

export function useBrands() {
  return useQuery({
    queryKey: mapKeys.brands(),
    queryFn: fetchBrands,
    staleTime: Infinity,
    select: sortByNameKo,
  });
}
