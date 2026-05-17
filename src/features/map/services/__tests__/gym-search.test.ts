import type { GymWithMachineCountResponse } from '@/shared/generated/model';
import type { GymWithMachineCount, MapBounds, SearchFilters } from '@/shared/types/database';

import { searchGymsInBounds } from '../gym-search';

const mockSearch = jest.fn();

jest.mock('@/shared/generated/gyms/gyms', () => ({
  search: (...args: unknown[]) => mockSearch(...args) as unknown,
}));

const bounds: MapBounds = {
  minLat: 37.48,
  minLng: 127.02,
  maxLat: 37.5,
  maxLng: 127.04,
};

const filtersWithBrand: SearchFilters = {
  brandIds: ['b1'],
  categoryIds: [],
  templateIds: [],
  machineFilterMode: 'or',
};

const filtersWithMultipleBrands: SearchFilters = {
  brandIds: ['b1', 'b2'],
  categoryIds: ['c1'],
  templateIds: [],
  machineFilterMode: 'or',
};

const emptyFilters: SearchFilters = {
  brandIds: [],
  categoryIds: [],
  templateIds: [],
  machineFilterMode: 'or',
};

const apiGym: GymWithMachineCountResponse = {
  id: 'g1',
  name: 'Test Gym',
  address: '123 Test St',
  latitude: 37.49,
  longitude: 127.03,
  isVerified: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  machineCount: 5,
  matchedMachineNames: [],
};

describe('searchGymsInBounds', () => {
  beforeEach(() => {
    mockSearch.mockReset();
  });

  it('calls search with bounds and filter params', async () => {
    mockSearch.mockResolvedValue([]);

    await searchGymsInBounds(bounds, filtersWithBrand);

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith({
      minLat: 37.48,
      maxLat: 37.5,
      minLng: 127.02,
      maxLng: 127.04,
      brandIds: ['b1'],
      categoryIds: undefined,
      templateIds: undefined,
      scope: undefined,
    });
  });

  it('passes undefined for empty filter arrays and OR mode', async () => {
    mockSearch.mockResolvedValue([]);

    await searchGymsInBounds(bounds, emptyFilters);

    expect(mockSearch).toHaveBeenCalledWith({
      minLat: 37.48,
      maxLat: 37.5,
      minLng: 127.02,
      maxLng: 127.04,
      brandIds: undefined,
      categoryIds: undefined,
      templateIds: undefined,
      scope: undefined,
    });
  });

  it('forwards multi-select brand and category ids verbatim', async () => {
    mockSearch.mockResolvedValue([]);

    await searchGymsInBounds(bounds, filtersWithMultipleBrands);

    expect(mockSearch).toHaveBeenCalledWith({
      minLat: 37.48,
      maxLat: 37.5,
      minLng: 127.02,
      maxLng: 127.04,
      brandIds: ['b1', 'b2'],
      categoryIds: ['c1'],
      templateIds: undefined,
      scope: undefined,
    });
  });

  it('forwards templateIds + scope=each when machine filter mode is or', async () => {
    mockSearch.mockResolvedValue([]);

    await searchGymsInBounds(bounds, {
      brandIds: [],
      categoryIds: [],
      templateIds: ['t1', 't2'],
      machineFilterMode: 'or',
    });

    expect(mockSearch).toHaveBeenCalledWith({
      minLat: 37.48,
      maxLat: 37.5,
      minLng: 127.02,
      maxLng: 127.04,
      brandIds: undefined,
      categoryIds: undefined,
      templateIds: ['t1', 't2'],
      scope: 'each',
    });
  });

  it('forwards templateIds + scope=combined when machine filter mode is and', async () => {
    mockSearch.mockResolvedValue([]);

    await searchGymsInBounds(bounds, {
      brandIds: [],
      categoryIds: [],
      templateIds: ['t1', 't2'],
      machineFilterMode: 'and',
    });

    expect(mockSearch).toHaveBeenCalledWith({
      minLat: 37.48,
      maxLat: 37.5,
      minLng: 127.02,
      maxLng: 127.04,
      brandIds: undefined,
      categoryIds: undefined,
      templateIds: ['t1', 't2'],
      scope: 'combined',
    });
  });

  it('maps camelCase API response to snake_case GymWithMachineCount', async () => {
    const fullApiGym: GymWithMachineCountResponse = {
      ...apiGym,
      phone: '+82-2-1234-5678',
      operatingHours: '09:00-22:00',
      dayPassPrice: 10000,
      lastVerifiedAt: '2026-03-01T00:00:00Z',
    };
    mockSearch.mockResolvedValue([fullApiGym]);

    const result = await searchGymsInBounds(bounds, emptyFilters);

    const expected: GymWithMachineCount = {
      id: 'g1',
      name: 'Test Gym',
      address: '123 Test St',
      latitude: 37.49,
      longitude: 127.03,
      phone: '+82-2-1234-5678',
      operating_hours: '09:00-22:00',
      day_pass_price: 10000,
      is_verified: true,
      last_verified_at: '2026-03-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      machine_count: 5,
    };
    expect(result).toEqual([expected]);
  });

  it('maps optional fields to null when absent', async () => {
    mockSearch.mockResolvedValue([apiGym]);

    const result = await searchGymsInBounds(bounds, emptyFilters);

    expect(result).toEqual([
      expect.objectContaining({
        phone: null,
        operating_hours: null,
        day_pass_price: null,
        last_verified_at: null,
      }),
    ]);
  });

  it('returns [] when API returns []', async () => {
    mockSearch.mockResolvedValue([]);

    const result = await searchGymsInBounds(bounds, emptyFilters);

    expect(result).toEqual([]);
  });

  it('propagates errors thrown by the API client', async () => {
    mockSearch.mockRejectedValue(new Error('db error'));

    await expect(searchGymsInBounds(bounds, emptyFilters)).rejects.toThrow('db error');
  });
});
