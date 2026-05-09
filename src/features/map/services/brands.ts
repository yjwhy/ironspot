import { listBrands } from '@/shared/generated/brands/brands';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';

export async function fetchBrands() {
  return unwrapOrvalResponse(await listBrands());
}
