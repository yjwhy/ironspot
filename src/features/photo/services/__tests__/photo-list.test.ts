import type { MachinePhoto } from '@/shared/types/database';
import { makeMachinePhoto } from '@/test/utils/factories/gym-machine';
import { mockFromEqOrderResult } from '@/test/utils/supabase-mocks';

import { getMachinePhotos } from '../photo-list';

const mockFrom = jest.fn();

jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args) as unknown,
  },
}));

const samplePhoto: MachinePhoto = makeMachinePhoto({ upvote_count: 7 });

describe('getMachinePhotos', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('queries machine_photos with select, eq on gym_machine_id, and orders by upvote_count desc', async () => {
    const { select, eq, order } = mockFromEqOrderResult<MachinePhoto>(mockFrom, {
      data: [samplePhoto],
      error: null,
    });

    const result = await getMachinePhotos('gm-1');

    expect(mockFrom).toHaveBeenCalledWith('machine_photos');
    expect(select).toHaveBeenCalledWith('*');
    expect(eq).toHaveBeenCalledWith('gym_machine_id', 'gm-1');
    expect(order).toHaveBeenCalledWith('upvote_count', { ascending: false });
    expect(result).toEqual([samplePhoto]);
  });

  it('returns [] when supabase returns null data with no error', async () => {
    mockFromEqOrderResult<MachinePhoto>(mockFrom, { data: null, error: null });

    const result = await getMachinePhotos('gm-1');

    expect(result).toEqual([]);
  });

  it('throws an Error containing the supabase error message on failure', async () => {
    mockFromEqOrderResult<MachinePhoto>(mockFrom, {
      data: null,
      error: { message: 'permission denied' },
    });

    await expect(getMachinePhotos('gm-1')).rejects.toThrow('permission denied');
  });
});
