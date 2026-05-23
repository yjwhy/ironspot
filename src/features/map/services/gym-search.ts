import { search } from '@/shared/generated/gyms/gyms';
import type { GymWithMachineCountResponse } from '@/shared/generated/model';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';
import type { GymWithMachineCount, MapBounds, SearchFilters } from '@/shared/types/database';

import { machineFilterModeToScope } from '../lib/active-filters';

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
    matched_machine_names: r.matchedMachineNames,
    cover_photo_url: r.coverPhotoUrl ?? null,
  };
}

export async function searchGymsInBounds(
  bounds: MapBounds,
  filters: SearchFilters,
): Promise<GymWithMachineCount[]> {
  const hasTemplates = filters.templateIds.length > 0;
  const result = unwrapOrvalResponse(
    await search({
      minLat: bounds.minLat,
      maxLat: bounds.maxLat,
      minLng: bounds.minLng,
      maxLng: bounds.maxLng,
      brandIds: filters.brandIds.length > 0 ? [...filters.brandIds] : undefined,
      categoryIds: filters.categoryIds.length > 0 ? [...filters.categoryIds] : undefined,
      // ADR 0022 / Slice 45h: templateIds + scope 동기 전송. templateIds 가
      // 비어있을 때 scope 는 의미 없으므로 함께 undefined. mode→scope 매핑은
      // active-filters.ts 의 단일 source-of-truth 헬퍼 사용 (NL 매핑과 일관).
      templateIds: hasTemplates ? [...filters.templateIds] : undefined,
      scope: hasTemplates ? machineFilterModeToScope(filters.machineFilterMode) : undefined,
    }),
  );
  return result.map(toGymWithMachineCount);
}
