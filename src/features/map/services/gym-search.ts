import { search } from '@/shared/generated/gyms/gyms';
import type { GymWithMachineCountResponse } from '@/shared/generated/model';
import type { GymWithMachineCount, MapBounds, SearchFilters } from '@/shared/types/database';

function toGymWithMachineCount(r: GymWithMachineCountResponse): GymWithMachineCount {
  return {
    id: r.id,
    name: r.name,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    phone: r.phone ?? null,
    operating_hours: r.operatingHours ?? null,
    day_pass_price: r.dayPassPrice ?? null,
    is_verified: r.isVerified,
    last_verified_at: r.lastVerifiedAt ?? null,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    machine_count: r.machineCount,
  };
}

export async function searchGymsInBounds(
  bounds: MapBounds,
  filters: SearchFilters,
): Promise<GymWithMachineCount[]> {
  const result = (await search({
    minLat: bounds.minLat,
    maxLat: bounds.maxLat,
    minLng: bounds.minLng,
    maxLng: bounds.maxLng,
    brandId: filters.brandId ?? undefined,
    categoryId: filters.categoryId ?? undefined,
    loadingType: filters.loadingType ?? undefined,
  })) as unknown as GymWithMachineCountResponse[];
  return result.map(toGymWithMachineCount);
}
