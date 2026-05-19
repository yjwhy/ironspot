import type { Coordinate } from '@/shared/hooks/useCurrentLocation';
import { haversineKm } from '@/shared/lib/geo';

export const SEOUL_CITY_HALL: Coordinate = {
  latitude: 37.5666,
  longitude: 126.9784,
};

export const KOREA_BBOX = {
  minLat: 33,
  maxLat: 39,
  minLng: 124,
  maxLng: 132,
} as const;

// First-paint camera zoom. Independent of any NL search; lives here so
// every camera-policy constant ships from one module.
export const INITIAL_MAP_ZOOM = 14;
// Fallback zoom when an NL search resolves without a radius (older NL
// queries, or queries that bypass the location-resolver). Same value as
// INITIAL_MAP_ZOOM today but conceptually distinct — change one without
// dragging the other.
export const DEFAULT_NL_ZOOM = 14;
export const MIN_NL_ZOOM = 10;
export const MAX_NL_ZOOM = 17;

// SDK animation timing for the NL camera move. The animated path is the
// default; the instant-snap path below is only taken when the cinematic
// would otherwise fire (see shouldBypassCinematicTransition).
export const CAMERA_ANIMATE_MS = 500;
// Empirically, calling animateCameraTo right inside the mutation onSuccess
// races marker insertion on iOS; a one-frame defer is enough to let React
// commit the new overlays first.
export const CAMERA_DEFER_MS = 50;
// Instant-snap path (duration: 0) still re-mounts overlays during the
// transition, so markers need a slightly longer runway before they can
// render without being cleared.
export const LONG_DISTANCE_CAMERA_DEFER_MS = 150;

// Cinematic transition (zoom out → pan → zoom in) on
// @mj-studio/react-native-naver-map fires for jumps in the hundreds of
// km and drops the target zoom. 500km keeps intra-Korea jumps (Seoul ↔
// Busan ~325km, Seoul ↔ Jeju ~450km) on the animated path while snapping
// for overseas → Korea hops where the cinematic loses meaning.
export const CINEMATIC_BYPASS_THRESHOLD_KM = 500;

export function isInsideKorea(loc: Coordinate): boolean {
  return (
    loc.latitude >= KOREA_BBOX.minLat &&
    loc.latitude <= KOREA_BBOX.maxLat &&
    loc.longitude >= KOREA_BBOX.minLng &&
    loc.longitude <= KOREA_BBOX.maxLng
  );
}

export function clampToKoreaBbox(loc: Coordinate): Coordinate {
  return isInsideKorea(loc) ? loc : SEOUL_CITY_HALL;
}

// Web Mercator approximation. The closed-form 15 - log2(radiusKm) lands
// between two integer zoom levels for most radii; we floor so the rendered
// viewport stays at-least-as-wide as the requested radius (rounding could
// pick a zoom that cuts the radius edge off-screen). Examples: 1km → 15,
// 3km → 13, 5km → 12, 10km → 11.
export function deriveZoomFromRadius(radiusKm: number | undefined): number {
  if (radiusKm === undefined || radiusKm <= 0) return DEFAULT_NL_ZOOM;
  const raw = Math.floor(15 - Math.log2(radiusKm));
  return Math.max(MIN_NL_ZOOM, Math.min(MAX_NL_ZOOM, raw));
}

// True when the start→target jump is far enough that the Naver SDK's
// cinematic transition would otherwise fire. `start` is the GPS-anchored
// search origin (clamped to Korea on app start), not the current camera
// centre — that keeps the threshold stable across consecutive NL searches
// and only triggers the snap path when the user's real GPS is overseas.
export function shouldBypassCinematicTransition(start: Coordinate, target: Coordinate): boolean {
  return haversineKm(start, target) > CINEMATIC_BYPASS_THRESHOLD_KM;
}

export interface ResolvedNlLocation {
  readonly coordinates?: { readonly lat?: number; readonly lng?: number };
  readonly radiusKm?: number;
}

export interface NlCameraPlan {
  readonly target: Coordinate;
  readonly zoom: number;
  readonly duration: number;
  readonly deferMs: number;
}

// Builds the camera transition for an NL search result. Returns `null` when
// the resolved location has no coordinates (NL response shape allows that —
// the caller should leave the camera where it is). Pure: no side effects,
// no `mapRef` access. Tested in __tests__/cameraUtils.test.ts.
export function planNlCamera(
  searchAnchor: Coordinate,
  resolved: ResolvedNlLocation,
): NlCameraPlan | null {
  const lat = resolved.coordinates?.lat;
  const lng = resolved.coordinates?.lng;
  if (lat === undefined || lng === undefined) return null;
  const target: Coordinate = { latitude: lat, longitude: lng };
  const bypassCinematic = shouldBypassCinematicTransition(searchAnchor, target);
  return {
    target,
    zoom: deriveZoomFromRadius(resolved.radiusKm),
    duration: bypassCinematic ? 0 : CAMERA_ANIMATE_MS,
    deferMs: bypassCinematic ? LONG_DISTANCE_CAMERA_DEFER_MS : CAMERA_DEFER_MS,
  };
}
