import type { Gym } from '@/shared/types/database';

import { getGymById } from '../gym-detail';

const mockFrom = jest.fn();

jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args) as unknown,
  },
}));

interface SingleChain {
  select: jest.Mock;
  eq: jest.Mock;
  maybeSingle: jest.Mock;
}

function mockFromEqMaybeSingleResult(result: {
  data: Gym | null;
  error: { message: string } | null;
}): SingleChain {
  const maybeSingle = jest.fn().mockResolvedValue(result);
  const eq = jest.fn().mockReturnValue({ maybeSingle });
  const select = jest.fn().mockReturnValue({ eq });
  mockFrom.mockReturnValue({ select });
  return { select, eq, maybeSingle };
}

const sampleGym: Gym = {
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
    mockFrom.mockReset();
  });

  it('queries the gyms table by id and returns the row', async () => {
    const { select, eq } = mockFromEqMaybeSingleResult({ data: sampleGym, error: null });

    const result = await getGymById('gym-1');

    expect(mockFrom).toHaveBeenCalledWith('gyms');
    expect(select).toHaveBeenCalledWith('*');
    expect(eq).toHaveBeenCalledWith('id', 'gym-1');
    expect(result).toEqual(sampleGym);
  });

  it('returns null when supabase returns no row (data null, no error)', async () => {
    mockFromEqMaybeSingleResult({ data: null, error: null });

    const result = await getGymById('missing');

    expect(result).toBeNull();
  });

  it('throws an Error containing the supabase error message on failure', async () => {
    mockFromEqMaybeSingleResult({
      data: null,
      error: { message: 'permission denied' },
    });

    await expect(getGymById('gym-1')).rejects.toThrow('permission denied');
  });
});
