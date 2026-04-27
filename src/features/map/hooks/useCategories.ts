import { useQuery } from '@tanstack/react-query';

import { mapKeys } from '../query-keys';
import { fetchCategories } from '../services/categories';

export function useCategories() {
  return useQuery({
    queryKey: mapKeys.categories(),
    queryFn: fetchCategories,
    staleTime: Infinity,
  });
}
