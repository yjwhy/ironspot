import type { GymMachineWithDetails } from '@/shared/types/database';
import { mockFromEqOrderResult } from '@/test/utils/supabase-mocks';

import { getGymMachines, SELECT_WITH_DETAILS } from '../gym-detail';

const mockFrom = jest.fn();

jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args) as unknown,
  },
}));

const sampleMachine: GymMachineWithDetails = {
  id: 'gm-1',
  gym_id: 'gym-1',
  template_id: 't-1',
  quantity: 1,
  is_custom: false,
  custom_name: null,
  last_verified_at: null,
  created_at: '2026-04-01',
  template: {
    id: 't-1',
    brand_id: 'b-1',
    category_id: 'c-1',
    name: 'High Row',
    loading_type: 'plate',
    is_approved: true,
    created_at: '2026-04-01',
    brand: { id: 'b-1', name: 'Panatta' },
    category: { id: 'c-1', name: 'Back' },
  },
  photos: [],
};

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
