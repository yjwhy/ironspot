import type { GymMachineWithDetails } from '@/shared/types/database';
import { makeGymMachineWithDetails } from '@/test/utils/factories/gym-machine';
import { mockFromEqOrderResult } from '@/test/utils/supabase-mocks';

import { getGymMachines, SELECT_WITH_DETAILS } from '../gym-detail';

const mockFrom = jest.fn();

jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args) as unknown,
  },
}));

const sampleMachine: GymMachineWithDetails = makeGymMachineWithDetails();

describe('getGymMachines', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('queries the gym_machines table with the joined select, eq, and order chain', async () => {
    const { select, eq, order } = mockFromEqOrderResult<GymMachineWithDetails>(mockFrom, {
      data: [sampleMachine],
      error: null,
    });

    const result = await getGymMachines('gym-1');

    expect(mockFrom).toHaveBeenCalledWith('gym_machines');
    expect(select).toHaveBeenCalledWith(SELECT_WITH_DETAILS);
    expect(eq).toHaveBeenCalledWith('gym_id', 'gym-1');
    expect(order).toHaveBeenCalledWith('template_id');
    expect(result).toEqual([sampleMachine]);
  });

  it('returns [] when supabase returns null data with no error', async () => {
    mockFromEqOrderResult<GymMachineWithDetails>(mockFrom, { data: null, error: null });

    const result = await getGymMachines('gym-1');

    expect(result).toEqual([]);
  });

  it('throws an Error containing the supabase error message on failure', async () => {
    mockFromEqOrderResult<GymMachineWithDetails>(mockFrom, {
      data: null,
      error: { message: 'permission denied' },
    });

    await expect(getGymMachines('gym-1')).rejects.toThrow('permission denied');
  });
});

describe('SELECT_WITH_DETAILS', () => {
  it('joins template, brand, category, and photos', () => {
    expect(SELECT_WITH_DETAILS).toMatch(/template:machine_templates/);
    expect(SELECT_WITH_DETAILS).toMatch(/brand:brands/);
    expect(SELECT_WITH_DETAILS).toMatch(/category:categories/);
    expect(SELECT_WITH_DETAILS).toMatch(/photos:machine_photos/);
  });
});
