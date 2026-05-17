import type { PhotoResponse } from '@/shared/generated/model';
import type { MachinePhoto } from '@/shared/types/database';

import { getMachinePhotos } from '../photo-list';

const mockListPhotos = jest.fn();

jest.mock('@/shared/generated/photos/photos', () => ({
  listPhotos: (...args: unknown[]) => mockListPhotos(...args) as unknown,
}));

const apiPhoto: PhotoResponse = {
  id: 'p1',
  gymMachineId: 'gm-1',
  userId: 'u1',
  photoUrl: 'https://example.com/photo.jpg',
  upvoteCount: 7,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('getMachinePhotos', () => {
  beforeEach(() => {
    mockListPhotos.mockReset();
  });

  it('calls listPhotos with gymMachineId and returns mapped MachinePhoto array', async () => {
    mockListPhotos.mockResolvedValue([apiPhoto]);

    const result = await getMachinePhotos('gm-1');

    expect(mockListPhotos).toHaveBeenCalledTimes(1);
    expect(mockListPhotos).toHaveBeenCalledWith('gm-1');
    const expected: MachinePhoto = {
      id: 'p1',
      gym_machine_id: 'gm-1',
      user_id: 'u1',
      photo_url: 'https://example.com/photo.jpg',
      upvote_count: 7,
      created_at: '2026-01-01T00:00:00Z',
      verified_by_owner_at: null, // Task 47: omitted from API response → null on the local type
    };
    expect(result).toEqual([expected]);
  });

  it('maps null userId to null user_id', async () => {
    const photoWithNullUser = { ...apiPhoto, userId: null as unknown as string };
    mockListPhotos.mockResolvedValue([photoWithNullUser]);

    const result = await getMachinePhotos('gm-1');

    expect(result).toEqual([expect.objectContaining({ user_id: null })]);
  });

  it('returns [] when API returns []', async () => {
    mockListPhotos.mockResolvedValue([]);

    const result = await getMachinePhotos('gm-1');

    expect(result).toEqual([]);
  });

  it('propagates errors thrown by the API client', async () => {
    mockListPhotos.mockRejectedValue(new Error('permission denied'));

    await expect(getMachinePhotos('gm-1')).rejects.toThrow('permission denied');
  });
});
