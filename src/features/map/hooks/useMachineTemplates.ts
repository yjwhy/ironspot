import { useQuery } from '@tanstack/react-query';

import type { ListTemplatesParams, MachineTemplateResponse } from '@/shared/generated/model';
import { templateDisplayName } from '@/shared/lib/template-display-name';

import { mapKeys } from '../query-keys';
import { fetchMachineTemplates } from '../services/machine-templates';

// Backend already returns templates sorted by brandName then templateName
// (MachineTemplateRepository.findAllApprovedDetailed). Client `select`
// re-applies the same sort for defensive consistency (FF predictability —
// any consumer can assume deterministic order regardless of server changes).
/**
 * Sort templates by brand (alphabetical), then by display name. Display name
 * is Korean primary with English fallback per item 18, so under same brand
 * the order follows what the user reads on the picker — not the underlying
 * English column. Renamed from `sortByBrandThenName` in slice (g) so the
 * call site signals the locale-aware second key.
 */
function sortByBrandThenDisplayName(
  items: readonly MachineTemplateResponse[],
): MachineTemplateResponse[] {
  return [...items].sort((a, b) => {
    const brand = a.brandName.localeCompare(b.brandName, 'ko');
    if (brand !== 0) return brand;
    return templateDisplayName(a).localeCompare(templateDisplayName(b), 'ko');
  });
}

export function useMachineTemplates(params?: ListTemplatesParams) {
  return useQuery({
    queryKey: mapKeys.machineTemplates({
      brandId: params?.brandId,
      categoryId: params?.categoryId,
      seriesId: params?.seriesId,
    }),
    queryFn: () => fetchMachineTemplates(params),
    staleTime: Infinity,
    select: sortByBrandThenDisplayName,
  });
}
