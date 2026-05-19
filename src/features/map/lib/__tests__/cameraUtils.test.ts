import {
  CAMERA_ANIMATE_MS,
  CAMERA_DEFER_MS,
  CINEMATIC_BYPASS_THRESHOLD_KM,
  DEFAULT_NL_ZOOM,
  INITIAL_MAP_ZOOM,
  KOREA_BBOX,
  LONG_DISTANCE_CAMERA_DEFER_MS,
  MAX_NL_ZOOM,
  MIN_NL_ZOOM,
  SEOUL_CITY_HALL,
  clampToKoreaBbox,
  deriveZoomFromRadius,
  isInsideKorea,
  planNlCamera,
  shouldBypassCinematicTransition,
} from '../cameraUtils';

jest.mock('@mj-studio/react-native-naver-map', () => ({}));

const SEOUL_STATION = { latitude: 37.5547, longitude: 126.9707 };
const GANGNAM_STATION = { latitude: 37.4979, longitude: 127.0276 };
const BUSAN_STATION = { latitude: 35.1156, longitude: 129.0419 };
const JEJU_CITY_HALL = { latitude: 33.4996, longitude: 126.5312 };
const AUCKLAND = { latitude: -36.8485, longitude: 174.7633 };
const TOKYO = { latitude: 35.6812, longitude: 139.7671 };
const NORTH_OF_BBOX = { latitude: 41.0, longitude: 127.0 };

describe('deriveZoomFromRadius', () => {
  it('maps 1km radius to zoom 15 (Web Mercator approximation)', () => {
    expect(deriveZoomFromRadius(1)).toBe(15);
  });

  it('maps 3km radius to zoom 13', () => {
    expect(deriveZoomFromRadius(3)).toBe(13);
  });

  it('maps 5km radius to zoom 12', () => {
    expect(deriveZoomFromRadius(5)).toBe(12);
  });

  it('falls back to DEFAULT_NL_ZOOM when radiusKm is undefined', () => {
    expect(deriveZoomFromRadius(undefined)).toBe(DEFAULT_NL_ZOOM);
  });

  it('falls back to DEFAULT_NL_ZOOM for non-positive radii', () => {
    expect(deriveZoomFromRadius(0)).toBe(DEFAULT_NL_ZOOM);
    expect(deriveZoomFromRadius(-1)).toBe(DEFAULT_NL_ZOOM);
  });

  it('clamps tiny radii to MAX_NL_ZOOM (zoom does not run away on 100m queries)', () => {
    expect(deriveZoomFromRadius(0.01)).toBe(MAX_NL_ZOOM);
  });

  it('clamps huge radii to MIN_NL_ZOOM (avoids zooming below the city level)', () => {
    expect(deriveZoomFromRadius(500)).toBe(MIN_NL_ZOOM);
  });
});

describe('isInsideKorea', () => {
  it('accepts Seoul', () => {
    expect(isInsideKorea(SEOUL_STATION)).toBe(true);
  });

  it('accepts Jeju (south edge of bbox)', () => {
    expect(isInsideKorea(JEJU_CITY_HALL)).toBe(true);
  });

  it('rejects Auckland (overseas tester scenario)', () => {
    expect(isInsideKorea(AUCKLAND)).toBe(false);
  });

  it('rejects Tokyo (neighbouring country, outside lng bound)', () => {
    expect(isInsideKorea(TOKYO)).toBe(false);
  });

  it('rejects coordinates north of the bbox', () => {
    expect(isInsideKorea(NORTH_OF_BBOX)).toBe(false);
  });

  it('exposes KOREA_BBOX as lat 33-39, lng 124-132 (locked Phase 5 item 13 decision)', () => {
    expect(KOREA_BBOX).toEqual({ minLat: 33, maxLat: 39, minLng: 124, maxLng: 132 });
  });
});

describe('clampToKoreaBbox', () => {
  it('keeps the original location when inside Korea', () => {
    expect(clampToKoreaBbox(GANGNAM_STATION)).toEqual(GANGNAM_STATION);
  });

  it('falls back to SEOUL_CITY_HALL when outside Korea (overseas tester scenario)', () => {
    expect(clampToKoreaBbox(AUCKLAND)).toEqual(SEOUL_CITY_HALL);
  });

  it('exposes SEOUL_CITY_HALL near 37.57, 126.98', () => {
    expect(SEOUL_CITY_HALL.latitude).toBeCloseTo(37.57, 1);
    expect(SEOUL_CITY_HALL.longitude).toBeCloseTo(126.98, 1);
  });
});

describe('shouldBypassCinematicTransition', () => {
  it('returns false for short intra-city jumps', () => {
    expect(shouldBypassCinematicTransition(SEOUL_STATION, GANGNAM_STATION)).toBe(false);
  });

  it('returns false for Seoul -> Busan (~325km, under the 500km threshold)', () => {
    expect(shouldBypassCinematicTransition(SEOUL_STATION, BUSAN_STATION)).toBe(false);
  });

  it('returns false for Seoul -> Jeju (~450km, under the 500km threshold)', () => {
    expect(shouldBypassCinematicTransition(SEOUL_STATION, JEJU_CITY_HALL)).toBe(false);
  });

  it('returns true for Auckland -> Seoul (overseas cinematic case)', () => {
    expect(shouldBypassCinematicTransition(AUCKLAND, SEOUL_STATION)).toBe(true);
  });

  it('exposes the threshold so wiring code can coordinate the marker defer', () => {
    expect(CINEMATIC_BYPASS_THRESHOLD_KM).toBe(500);
  });
});

describe('planNlCamera', () => {
  it('returns null when coordinates are missing (caller leaves camera in place)', () => {
    expect(planNlCamera(SEOUL_STATION, { radiusKm: 1 })).toBeNull();
    expect(planNlCamera(SEOUL_STATION, { coordinates: { lat: 37.5 }, radiusKm: 1 })).toBeNull();
  });

  it('builds the animated path for a short intra-Korea jump', () => {
    const plan = planNlCamera(SEOUL_STATION, {
      coordinates: { lat: GANGNAM_STATION.latitude, lng: GANGNAM_STATION.longitude },
      radiusKm: 1,
    });
    expect(plan).toEqual({
      target: { latitude: GANGNAM_STATION.latitude, longitude: GANGNAM_STATION.longitude },
      zoom: 15,
      duration: CAMERA_ANIMATE_MS,
      deferMs: CAMERA_DEFER_MS,
    });
  });

  it('threads radiusKm into the target zoom', () => {
    const plan = planNlCamera(SEOUL_STATION, {
      coordinates: { lat: GANGNAM_STATION.latitude, lng: GANGNAM_STATION.longitude },
      radiusKm: 3,
    });
    expect(plan?.zoom).toBe(13);
  });

  it('falls back to DEFAULT_NL_ZOOM when radiusKm is undefined', () => {
    const plan = planNlCamera(SEOUL_STATION, {
      coordinates: { lat: GANGNAM_STATION.latitude, lng: GANGNAM_STATION.longitude },
    });
    expect(plan?.zoom).toBe(DEFAULT_NL_ZOOM);
  });

  it('bypasses the cinematic for overseas → Korea jumps (duration 0, longer defer)', () => {
    const plan = planNlCamera(AUCKLAND, {
      coordinates: { lat: SEOUL_STATION.latitude, lng: SEOUL_STATION.longitude },
      radiusKm: 1,
    });
    expect(plan?.duration).toBe(0);
    expect(plan?.deferMs).toBe(LONG_DISTANCE_CAMERA_DEFER_MS);
  });

  it('keeps INITIAL_MAP_ZOOM and DEFAULT_NL_ZOOM independent (same value today, distinct meaning)', () => {
    expect(INITIAL_MAP_ZOOM).toBe(14);
    expect(DEFAULT_NL_ZOOM).toBe(14);
  });
});
