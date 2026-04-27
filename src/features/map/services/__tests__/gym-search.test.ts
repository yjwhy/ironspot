import type { GymWithMachineCount, MapBounds, SearchFilters } from '@/shared/types/database';
import { mockRpcResult } from '@/test/utils/supabase-mocks';

import { searchGymsInBounds } from '../gym-search';

const mockRpc = jest.fn();

jest.mock('@/shared/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args) as unknown,
  },
}));

const bounds: MapBounds = {
  minLat: 37.48,
  minLng: 127.02,
  maxLat: 37.5,
  maxLng: 127.04,
};

const filtersWithBrand: SearchFilters = {
  brandId: 'b1',
  categoryId: null,
  loadingType: 'plate',
};

const emptyFilters: SearchFilters = {
  brandId: null,
  categoryId: null,
  loadingType: null,
};

describe('searchGymsInBounds', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('calls supabase.rpc with the search_gyms_in_bounds name and the full param object', async () => {
    mockRpcResult<GymWithMachineCount>(mockRpc, { data: [], error: null });

    await searchGymsInBounds(bounds, filtersWithBrand);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('search_gyms_in_bounds', {
      min_lat: 37.48,
      min_lng: 127.02,
      max_lat: 37.5,
      max_lng: 127.04,
      brand_filter: 'b1',
      category_filter: null,
      loading_filter: 'plate',
    });
  });

  it('passes null filter values through as nulls', async () => {
    mockRpcResult<GymWithMachineCount>(mockRpc, { data: [], error: null });

    await searchGymsInBounds(bounds, emptyFilters);

    expect(mockRpc).toHaveBeenCalledWith('search_gyms_in_bounds', {
      min_lat: 37.48,
      min_lng: 127.02,
      max_lat: 37.5,
      max_lng: 127.04,
      brand_filter: null,
      category_filter: null,
      loading_filter: null,
    });
  });

  it('returns the data array when supabase resolves successfully', async () => {
    const gyms: GymWithMachineCount[] = [
      {
        id: 'g1',
        name: 'Test Gym',
        address: '123 Test St',
        latitude: 37.49,
        longitude: 127.03,
        phone: null,
        operating_hours: null,
        day_pass_price: null,
        is_verified: true,
        last_verified_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        machine_count: 5,
      },
    ];
    mockRpcResult<GymWithMachineCount>(mockRpc, { data: gyms, error: null });

    const result = await searchGymsInBounds(bounds, emptyFilters);

    expect(result).toEqual(gyms);
  });

  it('returns [] when supabase returns null data with no error', async () => {
    mockRpcResult<GymWithMachineCount>(mockRpc, { data: null, error: null });

    const result = await searchGymsInBounds(bounds, emptyFilters);

    expect(result).toEqual([]);
  });

  it('throws an Error containing the supabase error message on failure', async () => {
    mockRpcResult<GymWithMachineCount>(mockRpc, {
      data: null,
      error: { message: 'db error' },
    });

    await expect(searchGymsInBounds(bounds, emptyFilters)).rejects.toThrow('db error');
  });
});
