import { useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';

import { mapKeys } from '@/features/map/query-keys';
import { useCreateGym as useCreateGymMutation } from '@/shared/generated/gyms/gyms';
import type { CreateGymRequest } from '@/shared/generated/model/createGymRequest';
import type { GymDetailResponse } from '@/shared/generated/model/gymDetailResponse';
import type { NaverPlaceResult } from '@/shared/generated/model/naverPlaceResult';
import type { UnregisteredPlace } from '@/shared/generated/model/unregisteredPlace';

interface UseCreateGymOptions {
  onSuccess?: (gym: GymDetailResponse) => void;
  /**
   * Phase 5 item 14: lets the caller clear any local "in-flight place id"
   * tracking on the error edge so the bottom-sheet spinner stops decisively
   * rather than relying on the derived gating alone.
   */
  onError?: () => void;
}

/**
 * Wraps the generated `useCreateGym` mutation with a toast on each branch and
 * cache invalidation for the map's gym-search results so a freshly registered
 * gym appears in the bounding-box list without a manual refetch.
 *
 * The backend dedupes on `naverPlaceId`, so onSuccess fires for both the
 * "first registration" and "user re-tapped same place" cases.
 */
export function useCreateGym(options?: UseCreateGymOptions) {
  const queryClient = useQueryClient();
  const mutation = useCreateGymMutation({
    mutation: {
      onSuccess: (response) => {
        burnt.toast({ title: GYM_CREATED_TITLE, preset: 'done' });
        void queryClient.invalidateQueries({ queryKey: mapKeys.all });
        options?.onSuccess?.(response.data);
      },
      onError: () => {
        burnt.toast({ title: GYM_CREATE_FAILED_TITLE, preset: 'error' });
        options?.onError?.();
      },
    },
  });

  function handleCreateGym(place: NaverPlaceResult) {
    const data: CreateGymRequest = {
      name: place.name,
      address: place.roadAddress,
      latitude: place.latitude,
      longitude: place.longitude,
      naverPlaceId: place.id,
      ...(place.phone ? { phone: place.phone } : {}),
    };
    mutation.mutate({ data });
  }

  /**
   * Phase 5 item 14: MapScreen taps an UnregisteredGymCard and creates the
   * gym directly, bypassing the duplicate Naver-search step. UnregisteredPlace
   * carries a flat `address` (backend already falls back from road-name to
   * jibun when needed) and has no `phone` field, so the request omits phone
   * unconditionally — this is intentional asymmetry with `handleCreateGym`,
   * not an oversight.
   */
  function handleCreateGymFromUnregisteredPlace(place: UnregisteredPlace) {
    const data: CreateGymRequest = {
      name: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      naverPlaceId: place.naverPlaceId,
    };
    mutation.mutate({ data });
  }

  return {
    handleCreateGym,
    handleCreateGymFromUnregisteredPlace,
    isPending: mutation.isPending,
  };
}

const GYM_CREATED_TITLE = '헬스장을 등록했어요';
const GYM_CREATE_FAILED_TITLE = '헬스장 등록에 실패했어요';
