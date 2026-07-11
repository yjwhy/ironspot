import { templateCounts } from '@/shared/generated/gyms/gyms';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';
import type { MapBounds } from '@/shared/types/database';

/**
 * Per-template "gyms nearby" counts for the map filter badges: how many gyms
 * within the current bbox hold each machine template. Returned as a Map keyed
 * by templateId so the FilterSheet can annotate / sort / hide rows in O(1).
 * Templates absent from the response have no gym in bounds → treat as 0.
 */
export async function fetchTemplateCountsInBounds(
  bounds: MapBounds,
): Promise<ReadonlyMap<string, number>> {
  const result = unwrapOrvalResponse(
    await templateCounts({
      minLat: bounds.minLat,
      maxLat: bounds.maxLat,
      minLng: bounds.minLng,
      maxLng: bounds.maxLng,
    }),
  );
  const counts = new Map<string, number>();
  for (const row of result) {
    if (row.templateId !== undefined && row.gymCount !== undefined) {
      counts.set(row.templateId, row.gymCount);
    }
  }
  return counts;
}
