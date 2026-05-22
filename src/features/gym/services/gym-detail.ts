import { toMachinePhoto } from '@/features/photo/services/photo-list';
import { getById } from '@/shared/generated/gyms/gyms';
import { listMachines } from '@/shared/generated/machines/machines';
import type { GymDetailResponse, GymMachineResponse } from '@/shared/generated/model';
import { unwrapOrvalResponse } from '@/shared/lib/orval-response';
import type { Gym, GymMachineWithDetails, LoadingType } from '@/shared/types/database';

function toMachineTemplate(
  r: GymMachineResponse,
  templateId: string,
  brandId: string,
  categoryId: string,
) {
  return {
    id: templateId,
    brand_id: brandId,
    category_id: categoryId,
    name_en: r.machineNameEn ?? '',
    name_ko: r.machineNameKo ?? '',
    loading_type: (r.loadingType ?? 'plate') as LoadingType,
    is_approved: true, // DB field not returned by the list-machines API endpoint
    created_at: '', // DB field not returned by the list-machines API endpoint
    brand: { id: brandId, name: r.brandName ?? '', nameKo: r.brandNameKo ?? '' },
    category: { id: categoryId, name: r.categoryName ?? '' },
  };
}

function toGymMachineWithDetails(r: GymMachineResponse, gymId: string): GymMachineWithDetails {
  const templateId = r.templateId ?? '';
  const brandId = r.brandId ?? '';
  const categoryId = r.categoryId ?? '';
  return {
    id: r.id,
    gym_id: gymId,
    template_id: templateId,
    quantity: r.quantity,
    is_custom: r.isCustom,
    custom_name: r.customName ?? null,
    last_verified_at: r.lastVerifiedAt ?? null,
    created_at: '', // DB field not returned by the list-machines API endpoint
    template: toMachineTemplate(r, templateId, brandId, categoryId),
    photos: r.photos.map(toMachinePhoto),
  };
}

function toGym(r: GymDetailResponse): Gym {
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
  };
}

export async function getGymById(gymId: string): Promise<Gym> {
  const result = unwrapOrvalResponse(await getById(gymId));
  return toGym(result);
}

export async function getGymMachines(gymId: string): Promise<GymMachineWithDetails[]> {
  const result = unwrapOrvalResponse(await listMachines(gymId));
  return result.map((m) => toGymMachineWithDetails(m, gymId));
}
