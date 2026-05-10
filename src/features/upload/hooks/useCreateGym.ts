import { useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';

import { mapKeys } from '@/features/map/query-keys';
import { useCreateGym as useCreateGymMutation } from '@/shared/generated/gyms/gyms';
import type { CreateGymRequest } from '@/shared/generated/model/createGymRequest';
import type { GymDetailResponse } from '@/shared/generated/model/gymDetailResponse';
import type { NaverPlaceResult } from '@/shared/generated/model/naverPlaceResult';

interface UseCreateGymOptions {
  onSuccess?: (gym: GymDetailResponse) => void;
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

  return { handleCreateGym, isPending: mutation.isPending };
}

const GYM_CREATED_TITLE = '헬스장을 등록했어요';
const GYM_CREATE_FAILED_TITLE = '헬스장 등록에 실패했어요';
