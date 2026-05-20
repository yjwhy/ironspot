import { listTemplates } from '@/shared/generated/machine-templates/machine-templates';
import type { ListTemplatesParams, MachineTemplateResponse } from '@/shared/generated/model';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';

/**
 * ADR 0022 / Task 45: machine template catalog for the FilterSheet's
 * 머신 section. Returns approved templates with brand/loading metadata.
 *
 * Phase 5 item 18: optional brandId / categoryId narrow the result on the
 * server. Used by MachinePicker's TemplateStep to push the closed-list
 * filter down to the API.
 */
export async function fetchMachineTemplates(
  params?: ListTemplatesParams,
): Promise<MachineTemplateResponse[]> {
  return unwrapOrvalResponse(await listTemplates(params));
}
