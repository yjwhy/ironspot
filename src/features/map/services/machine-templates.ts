import { listTemplates } from '@/shared/generated/machine-templates/machine-templates';
import type { MachineTemplateResponse } from '@/shared/generated/model';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';

/**
 * ADR 0022 / Task 45: machine template catalog for the FilterSheet's
 * 머신 section. Returns approved templates with brand/loading metadata.
 */
export async function fetchMachineTemplates(): Promise<MachineTemplateResponse[]> {
  return unwrapOrvalResponse(await listTemplates());
}
