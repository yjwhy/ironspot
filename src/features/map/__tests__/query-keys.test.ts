import type { MapBounds, SearchFilters } from '@/shared/types/database';

import { mapKeys } from '../query-keys';

describe('mapKeys factory', () => {
  it('builds stable root key', () => {
    expect(mapKeys.all).toEqual(['map']);
  });

  it('nests brands under root', () => {
    expect(mapKeys.brands()).toEqual(['map', 'brands']);
  });

  it('nests categories under root', () => {
    expect(mapKeys.categories()).toEqual(['map', 'categories']);
  });

  it('nests machine templates under root', () => {
    expect(mapKeys.machineTemplates()).toEqual(['map', 'machine-templates']);
  });

  it('encodes bounds + filters in gym search key', () => {
    const bounds: MapBounds = { minLat: 37.48, minLng: 127.02, maxLat: 37.5, maxLng: 127.04 };
    const filters: SearchFilters = {
      brandIds: ['b1'],
      categoryIds: [],
      templateIds: [],
      machineFilterMode: 'or',
    };
    expect(mapKeys.gymSearch(bounds, filters)).toEqual(['map', 'search', bounds, filters]);
  });

  it('distinguishes null bounds from concrete bounds', () => {
    const filters: SearchFilters = {
      brandIds: [],
      categoryIds: [],
      templateIds: [],
      machineFilterMode: 'or',
    };
    const nullKey = mapKeys.gymSearch(null, filters);
    const boundedKey = mapKeys.gymSearch({ minLat: 0, minLng: 0, maxLat: 1, maxLng: 1 }, filters);
    expect(nullKey).not.toEqual(boundedKey);
  });
});
