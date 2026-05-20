import type { GymMachineResponse, PhotoResponse } from '@/shared/generated/model';

import { getGymMachines } from '../gym-detail';

const mockListMachines = jest.fn();

jest.mock('@/shared/generated/gyms/gyms', () => ({
  getById: jest.fn(),
}));

jest.mock('@/shared/generated/photos/photos', () => ({
  listPhotos: jest.fn(),
}));

jest.mock('@/shared/generated/machines/machines', () => ({
  listMachines: (...args: unknown[]) => mockListMachines(...args) as unknown,
}));

const apiPhoto: PhotoResponse = {
  id: 'p1',
  gymMachineId: 'gm-1',
  userId: 'u1',
  photoUrl: 'https://example.com/photo.jpg',
  upvoteCount: 3,
  createdAt: '2026-01-01T00:00:00Z',
};

const apiMachine: GymMachineResponse = {
  id: 'gm-1',
  quantity: 2,
  isCustom: false,
  customName: undefined,
  lastVerifiedAt: '2026-03-01T00:00:00Z',
  templateId: 'tmpl-1',
  machineNameEn: 'High Row',
  machineNameKo: '하이로우',
  loadingType: 'plate',
  brandId: 'b1',
  brandName: 'Panatta',
  categoryId: 'c1',
  categoryName: 'Row',
  photos: [apiPhoto],
};

describe('getGymMachines', () => {
  beforeEach(() => {
    mockListMachines.mockReset();
  });

  it('calls listMachines with gymId and returns mapped GymMachineWithDetails array', async () => {
    mockListMachines.mockResolvedValue([apiMachine]);

    const result = await getGymMachines('gym-1');

    expect(mockListMachines).toHaveBeenCalledTimes(1);
    expect(mockListMachines).toHaveBeenCalledWith('gym-1');
    expect(result).toHaveLength(1);
  });

  it('maps flat API response to nested GymMachineWithDetails shape', async () => {
    mockListMachines.mockResolvedValue([apiMachine]);

    const result = await getGymMachines('gym-1');

    expect(result).toMatchObject([
      {
        id: 'gm-1',
        gym_id: 'gym-1',
        quantity: 2,
        is_custom: false,
        custom_name: null,
        last_verified_at: '2026-03-01T00:00:00Z',
        template: {
          id: 'tmpl-1',
          name_en: 'High Row',
          name_ko: '하이로우',
          loading_type: 'plate',
          brand: { id: 'b1', name: 'Panatta' },
          category: { id: 'c1', name: 'Row' },
        },
        photos: [{ id: 'p1', upvote_count: 3 }],
      },
    ]);
  });

  it('maps null/undefined optional fields to null', async () => {
    const machineNoOptionals: GymMachineResponse = {
      id: 'gm-2',
      quantity: 1,
      isCustom: true,
      photos: [],
    };
    mockListMachines.mockResolvedValue([machineNoOptionals]);

    const result = await getGymMachines('gym-1');

    expect(result).toMatchObject([
      { is_custom: true, custom_name: null, last_verified_at: null, photos: [] },
    ]);
  });

  it('returns [] when API returns []', async () => {
    mockListMachines.mockResolvedValue([]);

    const result = await getGymMachines('gym-1');

    expect(result).toEqual([]);
  });

  it('propagates errors thrown by the API client', async () => {
    mockListMachines.mockRejectedValue(new Error('permission denied'));

    await expect(getGymMachines('gym-1')).rejects.toThrow('permission denied');
  });
});
