import { listCategories } from '@/shared/generated/categories/categories';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';

export async function fetchCategories() {
  return unwrapOrvalResponse(await listCategories());
}
