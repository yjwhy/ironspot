import { renderHook, waitFor } from '@testing-library/react-native';

import type { GymWithMachineCount, MapBounds, SearchFilters } from '@/shared/types/database';
import { createQueryWrapper } from '@/test/utils/query-wrapper';

import { searchGymsInBounds } from '../../services/gym-search';
import { useGymSearch } from '../useGymSearch';

jest.mock('../../services/gym-search', () => ({
  searchGymsInBounds: jest.fn(),
}));

const bounds: MapBounds = {
  minLat: 37.48,
  minLng: 127.02,
  maxLat: 37.5,
  maxLng: 127.04,
};

const filters: SearchFilters = {
  brandIds: ['b1'],
  categoryIds: [],
  templateIds: [],
  machineFilterMode: 'or',
};

describe('useGymSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is disabled when bounds is null and does not call the service', () => {
    const mockSearch = searchGymsInBounds as jest.MockedFunction<typeof searchGymsInBounds>;
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useGymSearch(null, filters), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('calls searchGymsInBounds with the provided bounds and filters when bounds is set', async () => {
    const gyms: GymWithMachineCount[] = [];
    const mockSearch = searchGymsInBounds as jest.MockedFunction<typeof searchGymsInBounds>;
    mockSearch.mockResolvedValue(gyms);
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useGymSearch(bounds, filters), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith(bounds, filters);
  });

  it('returns the data on success', async () => {
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
        machine_count: 3,
      },
    ];
    const mockSearch = searchGymsInBounds as jest.MockedFunction<typeof searchGymsInBounds>;
    mockSearch.mockResolvedValue(gyms);
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useGymSearch(bounds, filters), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(gyms);
  });

  it('exposes an error state when the service rejects', async () => {
    const mockSearch = searchGymsInBounds as jest.MockedFunction<typeof searchGymsInBounds>;
    mockSearch.mockRejectedValue(new Error('boom'));
    const { Wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useGymSearch(bounds, filters), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
