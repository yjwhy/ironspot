import type { UnregisteredPlace } from '@/shared/generated/model';
import type { Coordinate } from '@/shared/hooks/useCurrentLocation';
import { haversineKm } from '@/shared/lib/geo';
import type { GymWithMachineCount } from '@/shared/types/database';

// Discriminated union over the two list-item sources. `kind` drives the tap
// target (gym detail vs. register flow) and the view-model mapping, not the
// sort order. The bottom sheet and `toGymResultCardModel` both switch on it
// exhaustively, so adding a kind surfaces as a compile error at those sites.
export type BottomSheetListItem =
  | { readonly kind: 'gym'; readonly gym: GymWithMachineCount; readonly distanceKm: number }
  | {
      readonly kind: 'unregistered';
      readonly place: UnregisteredPlace;
      readonly distanceKm: number;
    };

export function bottomSheetListItemKey(item: BottomSheetListItem): string {
  return item.kind === 'gym' ? `gym:${item.gym.id}` : `naver:${item.place.naverPlaceId}`;
}

// Builds the bottom sheet list from registered gyms + unregistered Naver
// places, sorted by distance ascending.
//
// The list now renders one unified card design (GymResultCard) regardless of
// source, so an earlier kind-first sort (registered gyms before Naver places)
// would read as a random order on visually-identical cards. Distance is the
// only axis the user can see, so it is the only axis we sort on. Source still
// drives the tap target (gym detail vs. register flow), not the ordering.
export function buildBottomSheetList(
  userLocation: Coordinate,
  gyms: readonly GymWithMachineCount[],
  unregisteredPlaces: readonly UnregisteredPlace[] = [],
): readonly BottomSheetListItem[] {
  const gymItems: BottomSheetListItem[] = gyms.map((gym) => ({
    kind: 'gym',
    gym,
    distanceKm: haversineKm(userLocation, {
      latitude: gym.latitude,
      longitude: gym.longitude,
    }),
  }));
  const placeItems: BottomSheetListItem[] = unregisteredPlaces.map((place) => ({
    kind: 'unregistered',
    place,
    distanceKm: haversineKm(userLocation, {
      latitude: place.latitude,
      longitude: place.longitude,
    }),
  }));
  return [...gymItems, ...placeItems].sort((a, b) => a.distanceKm - b.distanceKm);
}
