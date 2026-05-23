import type { UnregisteredPlace } from '@/shared/generated/model';
import type { Coordinate } from '@/shared/hooks/useCurrentLocation';
import type { GymWithMachineCount } from '@/shared/types/database';

import { bottomSheetListItemKey, buildBottomSheetList } from '../sort-bottom-sheet-list';

const USER_LOCATION: Coordinate = { latitude: 37.4979, longitude: 127.0276 }; // 강남역

function makeGym(id: string, name: string, lat: number, lng: number): GymWithMachineCount {
  return {
    id,
    name,
    address: '주소',
    latitude: lat,
    longitude: lng,
    phone: null,
    operating_hours: null,
    day_pass_price: null,
    is_verified: false,
    last_verified_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    machine_count: 1,
    matched_machine_names: [],
    cover_photo_url: null,
  };
}

function makePlace(id: string, name: string, lat: number, lng: number): UnregisteredPlace {
  return { naverPlaceId: id, name, address: '주소', latitude: lat, longitude: lng };
}

describe('buildBottomSheetList', () => {
  it('returns an empty list when both inputs are empty', () => {
    expect(buildBottomSheetList(USER_LOCATION, [])).toEqual([]);
    expect(buildBottomSheetList(USER_LOCATION, [], [])).toEqual([]);
  });

  it('places registered gyms above unregistered places even when registered are farther', () => {
    const farGym = makeGym('g-far', 'Far Gym', 37.5547, 126.9707); // ~5km
    const nearPlace = makePlace('np-near', 'Near Place', 37.4985, 127.028); // ~0.1km
    const result = buildBottomSheetList(USER_LOCATION, [farGym], [nearPlace]);
    expect(result.map((i) => i.kind)).toEqual(['gym', 'unregistered']);
    expect(result[0]).toMatchObject({ kind: 'gym', gym: { id: 'g-far' } });
    expect(result[1]).toMatchObject({ kind: 'unregistered', place: { naverPlaceId: 'np-near' } });
  });

  it('sorts registered gyms by distance among themselves', () => {
    const farGym = makeGym('g-far', 'Far Gym', 37.5547, 126.9707);
    const nearGym = makeGym('g-near', 'Near Gym', 37.4985, 127.028);
    const result = buildBottomSheetList(USER_LOCATION, [farGym, nearGym]);
    expect(result.map((i) => (i.kind === 'gym' ? i.gym.id : 'naver'))).toEqual(['g-near', 'g-far']);
  });

  it('sorts unregistered places by distance among themselves', () => {
    const farPlace = makePlace('np-far', 'Far Place', 37.5547, 126.9707);
    const nearPlace = makePlace('np-near', 'Near Place', 37.4985, 127.028);
    const result = buildBottomSheetList(USER_LOCATION, [], [farPlace, nearPlace]);
    expect(result.map((i) => (i.kind === 'unregistered' ? i.place.naverPlaceId : 'gym'))).toEqual([
      'np-near',
      'np-far',
    ]);
  });

  it('keeps the kind-first order even when a registered gym is exactly co-located with an unregistered place', () => {
    const sameCoord = { latitude: 37.4985, longitude: 127.028 };
    const gym = makeGym('g-1', 'Gym', sameCoord.latitude, sameCoord.longitude);
    const place = makePlace('np-1', 'Place', sameCoord.latitude, sameCoord.longitude);
    const result = buildBottomSheetList(USER_LOCATION, [gym], [place]);
    expect(result.map((i) => i.kind)).toEqual(['gym', 'unregistered']);
  });

  it('computes haversine distance from the supplied user location', () => {
    const sameCoord = { latitude: USER_LOCATION.latitude, longitude: USER_LOCATION.longitude };
    const gym = makeGym('g-1', 'Gym', sameCoord.latitude, sameCoord.longitude);
    const result = buildBottomSheetList(USER_LOCATION, [gym]);
    expect(result[0]?.distanceKm).toBeCloseTo(0, 4);
  });

  it('treats omitted unregisteredPlaces as an empty list', () => {
    const gym = makeGym('g-1', 'Gym', 37.4985, 127.028);
    const result = buildBottomSheetList(USER_LOCATION, [gym]);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe('gym');
  });
});

describe('bottomSheetListItemKey', () => {
  it('prefixes gym ids with "gym:"', () => {
    const gym = makeGym('abc', 'Gym', 37.5, 127);
    expect(bottomSheetListItemKey({ kind: 'gym', gym, distanceKm: 0 })).toBe('gym:abc');
  });

  it('prefixes unregistered place ids with "naver:"', () => {
    const place = makePlace('xyz', 'Place', 37.5, 127);
    expect(bottomSheetListItemKey({ kind: 'unregistered', place, distanceKm: 0 })).toBe(
      'naver:xyz',
    );
  });
});
