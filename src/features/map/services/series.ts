import { listSeries } from '@/shared/generated/series/series';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';

export async function fetchSeries() {
  return unwrapOrvalResponse(await listSeries());
}
