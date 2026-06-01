import type { BottomSheetListItem } from './sort-bottom-sheet-list';

/**
 * Normalised presentation model for the unified gym result card. Both a
 * registered gym (in our DB) and an unregistered Naver place collapse into
 * this single shape so the bottom-sheet list renders one card design rather
 * than forking on a data-source axis the user neither knows nor cares about.
 *
 * Content-driven differences survive (a registered gym may carry a thumbnail
 * + verified date; an unregistered place never does), but the card chrome,
 * copy and CTA are identical. `machineCount === 0` is the shared "empty"
 * state for both a confirmed-empty registered gym and an unregistered place.
 */
export interface GymResultCardModel {
  /** Registered gym id, or the Naver place id for unregistered places. Used for the directions breadcrumb. */
  readonly id: string;
  readonly name: string;
  readonly distanceKm: number;
  readonly address: string | null;
  readonly machineCount: number;
  readonly thumbnailUrl: string | null;
  readonly lastVerifiedAt: string | null;
  readonly latitude: number;
  readonly longitude: number;
  /** Naver place id when the source is an unregistered place; null for registered gyms. */
  readonly naverPlaceId: string | null;
}

export function toGymResultCardModel(item: BottomSheetListItem): GymResultCardModel {
  if (item.kind === 'gym') {
    const { gym } = item;
    return {
      id: gym.id,
      name: gym.name,
      distanceKm: item.distanceKm,
      address: gym.address,
      machineCount: gym.machine_count,
      thumbnailUrl: gym.cover_photo_url,
      lastVerifiedAt: gym.last_verified_at,
      latitude: gym.latitude,
      longitude: gym.longitude,
      naverPlaceId: null,
    };
  }
  const { place } = item;
  return {
    id: place.naverPlaceId,
    name: place.name,
    distanceKm: item.distanceKm,
    address: place.address,
    // An unregistered place has no machine data yet — the same "empty" state
    // as a registered gym with machine_count 0.
    machineCount: 0,
    thumbnailUrl: null,
    lastVerifiedAt: null,
    latitude: place.latitude,
    longitude: place.longitude,
    naverPlaceId: place.naverPlaceId,
  };
}
