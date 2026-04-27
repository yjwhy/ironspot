import { supabase } from '@/shared/lib/supabase';
import { unwrapList } from '@/shared/lib/supabase-helpers';
import type { GymWithMachineCount, MapBounds, SearchFilters } from '@/shared/types/database';

export async function searchGymsInBounds(
  bounds: MapBounds,
  filters: SearchFilters,
): Promise<GymWithMachineCount[]> {
  const response = await supabase.rpc('search_gyms_in_bounds', {
    min_lat: bounds.minLat,
    min_lng: bounds.minLng,
    max_lat: bounds.maxLat,
    max_lng: bounds.maxLng,
    brand_filter: filters.brandId,
    category_filter: filters.categoryId,
    loading_filter: filters.loadingType,
  });
  return unwrapList<GymWithMachineCount>(response);
}
