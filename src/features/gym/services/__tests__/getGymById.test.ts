import type { GymDetailResponse } from '@/shared/generated/model';
import type { Gym } from '@/shared/types/database';

import { getGymById } from '../gym-detail';

const mockGetById = jest.fn();

jest.mock('@/shared/generated/gyms/gyms', () => ({
  getById: (...args: unknown[]) => mockGetById(...args) as unknown,
}));

jest.mock('@/shared/generated/photos/photos', () => ({
  listPhotos: jest.fn(),
}));

jest.mock('@/shared/generated/machines/machines', () => ({
  listMachines: jest.fn(),
}));

const apiGym: GymDetailResponse = {
  id: 'gym-1',
  name: 'Fitness Factory',
  address: '서울 강남구',
  latitude: 37.4985,
  longitude: 127.0282,
  isVerified: true,
  lastVerifiedAt: '2026-03-15T10:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const expectedGym: Gym = {
  id: 'gym-1',
  name: 'Fitness Factory',
  address: '서울 강남구',
  latitude: 37.4985,
  longitude: 127.0282,
  phone: null,
  operating_hours: null,
  day_pass_price: null,
  is_verified: true,
  last_verified_at: '2026-03-15T10:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('getGymById', () => {
  beforeEach(() => {
    mockGetById.mockReset();
  });

  it('calls getById with gymId and returns mapped Gym', async () => {
    mockGetById.mockResolvedValue(apiGym);

    const result = await getGymById('gym-1');

    expect(mockGetById).toHaveBeenCalledTimes(1);
    expect(mockGetById).toHaveBeenCalledWith('gym-1');
    expect(result).toEqual(expectedGym);
  });

  it('maps optional fields to null when absent', async () => {
    mockGetById.mockResolvedValue(apiGym);

    const result = await getGymById('gym-1');

    expect(result.phone).toBeNull();
    expect(result.operating_hours).toBeNull();
    expect(result.day_pass_price).toBeNull();
  });

  it('propagates errors thrown by the API client', async () => {
    mockGetById.mockRejectedValue(new Error('permission denied'));

    await expect(getGymById('gym-1')).rejects.toThrow('permission denied');
  });
});
