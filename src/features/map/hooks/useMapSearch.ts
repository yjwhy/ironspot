import type { Region } from '@mj-studio/react-native-naver-map';
import { useEffect, useState } from 'react';

import type { MapBounds, SearchFilters } from '@/shared/types/database';

import { useGymSearch } from './useGymSearch';
import { regionToMapBounds } from '../lib/mapUtils';

export function useMapSearch(filters: SearchFilters) {
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [searchBounds, setSearchBounds] = useState<MapBounds | null>(null);

  const { data: gyms = [], isPending } = useGymSearch(searchBounds, filters);

  useEffect(
    function triggerInitialSearch() {
      if (bounds !== null && searchBounds === null) {
        setSearchBounds(bounds);
      }
    },
    [bounds, searchBounds],
  );

  const hasBounds = bounds !== null;
  const viewportDiffersFromSearch = bounds !== searchBounds;
  const showSearchButton = hasBounds && viewportDiffersFromSearch;

  function handleCameraIdle({ region }: { region: Region }) {
    setBounds(regionToMapBounds(region));
  }

  function handleSearch() {
    if (bounds !== null) {
      setSearchBounds(bounds);
    }
  }

  return { gyms, isPending, showSearchButton, searchBounds, handleCameraIdle, handleSearch };
}
