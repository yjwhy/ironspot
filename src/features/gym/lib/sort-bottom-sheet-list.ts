import type { UnregisteredPlace } from '@/shared/generated/model';
import type { Coordinate } from '@/shared/hooks/useCurrentLocation';
import { haversineKm } from '@/shared/lib/geo';
import type { GymWithMachineCount } from '@/shared/types/database';

// Discriminated union over the two card kinds the bottom sheet renders.
// `kind` is the sort priority axis; the discriminator stays a single
// closed set so new kinds force a compile error in KIND_RANK below.
export type BottomSheetListItem =
  | { readonly kind: 'gym'; readonly gym: GymWithMachineCount; readonly distanceKm: number }
  | {
      readonly kind: 'unregistered';
      readonly place: UnregisteredPlace;
      readonly distanceKm: number;
    };

// Phase 5 item 21 sort policy. Registered gyms (kind: 'gym') always come
// before unregistered Naver places (kind: 'unregistered'); within each
// group cards are ordered by distance ascending. Using a Record<kind, rank>
// makes the sort policy explicit and forces a TypeScript error if a third
// `kind` variant is ever added without updating the rank table.
const KIND_RANK: Record<BottomSheetListItem['kind'], number> = {
  gym: 0,
  unregistered: 1,
};

export function bottomSheetListItemKey(item: BottomSheetListItem): string {
  return item.kind === 'gym' ? `gym:${item.gym.id}` : `naver:${item.place.naverPlaceId}`;
}

// Builds the bottom sheet list from registered gyms + unregistered Naver
// places, applying the Phase 5 item 21 sort policy (kind-first, distance-second).
//
// Trade-off: a far registered gym ranks ahead of a near unregistered place,
// which breaks pure-distance expectation. Map markers preserve the spatial
// signal, and as registered density grows the Naver merge backend drops
// already-registered IDs out of `unregisteredPlaces`, so the kind-first
// branch naturally fires less often and the order converges to pure
// distance sort.
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
  return [...gymItems, ...placeItems].sort(
    (a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.distanceKm - b.distanceKm,
  );
}
