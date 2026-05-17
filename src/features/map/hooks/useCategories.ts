import { useQuery } from '@tanstack/react-query';

import type { Category } from '@/shared/types/database';

import { mapKeys } from '../query-keys';
import { fetchCategories } from '../services/categories';

function sortByNameKo(items: readonly Category[]): Category[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

export function useCategories() {
  return useQuery({
    queryKey: mapKeys.categories(),
    queryFn: fetchCategories,
    staleTime: Infinity,
    select: sortByNameKo,
  });
}
