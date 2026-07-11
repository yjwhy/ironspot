import type { UnregisteredPlace } from '@/shared/generated/model';
import type { GymWithMachineCount } from '@/shared/types/database';

import { toGymResultCardModel } from '../gym-result-card-model';
import type { BottomSheetListItem } from '../sort-bottom-sheet-list';

const gym: GymWithMachineCount = {
  id: 'g1',
  name: '카인드짐 보정점',
  address: '경기 용인 기흥구 보정로 57',
  latitude: 37.5,
  longitude: 127.03,
  phone: null,
  operating_hours: null,
  day_pass_price: null,
  is_verified: true,
  last_verified_at: '2026-03-15T10:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  machine_count: 0,
  matched_machine_names: [],
  cover_photo_url: 'https://cdn.example.com/cover.jpg',
};

const place: UnregisteredPlace = {
  naverPlaceId: 'naver-123',
  name: '더뺌 보정점',
  address: '경기 용인 기흥구 죽전로 57',
  latitude: 37.51,
  longitude: 127.04,
};

describe('toGymResultCardModel', () => {
  it('maps a registered gym, preserving its machine count, address, thumbnail and verified date', () => {
    const item: BottomSheetListItem = { kind: 'gym', gym, distanceKm: 0.3 };
    const model = toGymResultCardModel(item);
    expect(model).toEqual({
      id: 'g1',
      name: '카인드짐 보정점',
      distanceKm: 0.3,
      address: '경기 용인 기흥구 보정로 57',
      machineCount: 0,
      thumbnailUrl: 'https://cdn.example.com/cover.jpg',
      lastVerifiedAt: '2026-03-15T10:00:00Z',
      latitude: 37.5,
      longitude: 127.03,
      naverPlaceId: null,
    });
  });

  it('maps an unregistered Naver place to a 0-machine, no-thumbnail model carrying its naverPlaceId', () => {
    const item: BottomSheetListItem = { kind: 'unregistered', place, distanceKm: 0.5 };
    const model = toGymResultCardModel(item);
    expect(model).toEqual({
      id: 'naver-123',
      name: '더뺌 보정점',
      distanceKm: 0.5,
      address: '경기 용인 기흥구 죽전로 57',
      machineCount: 0,
      thumbnailUrl: null,
      lastVerifiedAt: null,
      latitude: 37.51,
      longitude: 127.04,
      naverPlaceId: 'naver-123',
    });
  });
});
