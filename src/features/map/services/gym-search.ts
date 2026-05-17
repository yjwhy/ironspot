import { search } from '@/shared/generated/gyms/gyms';
import type { GymWithMachineCountResponse } from '@/shared/generated/model';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';
import type { GymWithMachineCount, MapBounds, SearchFilters } from '@/shared/types/database';

export function toGymWithMachineCount(r: GymWithMachineCountResponse): GymWithMachineCount {
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
  const result = unwrapOrvalResponse(
    await search({
      minLat: bounds.minLat,
      maxLat: bounds.maxLat,
      minLng: bounds.minLng,
      maxLng: bounds.maxLng,
      brandIds: filters.brandIds.length > 0 ? [...filters.brandIds] : undefined,
      categoryIds: filters.categoryIds.length > 0 ? [...filters.categoryIds] : undefined,
      // ADR 0022 / Slice 45f: templateIds + scope 전송은 Slice 45f 에서 추가
      // (SearchFilters 타입 확장 + useFilters 토글 후). 본 슬라이스 (45e) 는
      // codegen 결과 (loadingType 제거) 만 반영.
    }),
  );
  return result.map(toGymWithMachineCount);
}
