import { useQuery } from '@tanstack/react-query';

import type { ListTemplatesParams, MachineTemplateResponse } from '@/shared/generated/model';

import { mapKeys } from '../query-keys';
import { fetchMachineTemplates } from '../services/machine-templates';

// Backend already returns templates sorted by brandName then templateName
// (MachineTemplateRepository.findAllApprovedDetailed). Client `select`
// re-applies the same sort for defensive consistency (FF predictability —
// any consumer can assume deterministic order regardless of server changes).
function sortByBrandThenName(items: readonly MachineTemplateResponse[]): MachineTemplateResponse[] {
  return [...items].sort((a, b) => {
    const brand = a.brandName.localeCompare(b.brandName, 'ko');
    if (brand !== 0) return brand;
    // Phase 5 item 18: sort by Korean primary so the picker / filter UI reads
    // in 가나다 order. Fall back to English when Korean is empty so legacy rows
    // still slot somewhere deterministic.
    const aKey = a.nameKo || a.nameEn;
    const bKey = b.nameKo || b.nameEn;
    return aKey.localeCompare(bKey, 'ko');
  });
}

export function useMachineTemplates(params?: ListTemplatesParams) {
  return useQuery({
    queryKey: mapKeys.machineTemplates({
      brandId: params?.brandId,
      categoryId: params?.categoryId,
    }),
    queryFn: () => fetchMachineTemplates(params),
    staleTime: Infinity,
    select: sortByBrandThenName,
  });
}
