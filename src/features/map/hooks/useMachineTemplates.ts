import { useQuery } from '@tanstack/react-query';

import type { MachineTemplateResponse } from '@/shared/generated/model';

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
    return a.name.localeCompare(b.name, 'ko');
  });
}

export function useMachineTemplates() {
  return useQuery({
    queryKey: mapKeys.machineTemplates(),
    queryFn: fetchMachineTemplates,
    staleTime: Infinity,
    select: sortByBrandThenName,
  });
}
