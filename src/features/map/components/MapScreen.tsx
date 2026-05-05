import { NaverMapView } from '@mj-studio/react-native-naver-map';
import type { Region } from '@mj-studio/react-native-naver-map';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { GymBottomSheet } from '@/features/gym/components/GymBottomSheet';
import { GANGNAM_STATION, useCurrentLocation } from '@/shared/hooks/useCurrentLocation';
import { ANIMATION } from '@/shared/theme/tokens';
import type { MapBounds } from '@/shared/types/database';

import { FilterBar } from './FilterBar';
import { GymMarker } from './GymMarker';
import { SearchAreaButton } from './SearchAreaButton';
import { useBrands } from '../hooks/useBrands';
import { useCategories } from '../hooks/useCategories';
import { useFilters } from '../hooks/useFilters';
import { useGymSearch } from '../hooks/useGymSearch';
import { regionToMapBounds } from '../lib/mapUtils';

const INITIAL_ZOOM = 14;

export function MapScreen() {
  const router = useRouter();
  const locationState = useCurrentLocation();
  const { filters, setBrand, setCategory, clear: clearFilters } = useFilters();
  const { data: brands = [] } = useBrands();
  const { data: categories = [] } = useCategories();

  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [searchBounds, setSearchBounds] = useState<MapBounds | null>(null);
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [visibleMarkerIds, setVisibleMarkerIds] = useState<readonly string[]>([]);

  const { data: gyms = [], isPending } = useGymSearch(searchBounds, filters);

  // Stagger-reveal markers when gyms update
  useEffect(() => {
    if (gyms.length === 0) {
      setVisibleMarkerIds([]);
      return;
    }
    setVisibleMarkerIds([]);
    const ids = gyms.map((g) => g.id);
    const timers = ids.map((id, i) =>
      setTimeout(() => {
        setVisibleMarkerIds((prev) => [...prev, id]);
      }, i * ANIMATION.stagger),
    );
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [gyms]);

  const showSearchButton = bounds !== null && bounds !== searchBounds;

  function handleCameraIdle({ region }: { region: Region }) {
    const newBounds = regionToMapBounds(region);
    setBounds(newBounds);
    // Auto-search on first camera idle (no prior searchBounds)
    if (searchBounds === null) {
      setSearchBounds(newBounds);
    }
  }

  function handleSearch() {
    if (bounds !== null) {
      setSearchBounds(bounds);
    }
  }

  const selectedGym =
    selectedGymId !== null ? (gyms.find((g) => g.id === selectedGymId) ?? null) : null;

  function handlePressMachine(gymMachineId: string) {
    if (selectedGymId === null) return;
    router.push(`/gym/${selectedGymId}/machine/${gymMachineId}`);
  }

  const initialLocation = locationState.status !== 'loading' ? locationState.location : null;

  const bottomSheetMode =
    selectedGym !== null
      ? {
          type: 'detail' as const,
          selectedGym,
          onCloseDetail: () => {
            setSelectedGymId(null);
          },
          onPressMachine: handlePressMachine,
        }
      : {
          type: 'list' as const,
          gyms,
          userLocation: initialLocation ?? GANGNAM_STATION,
          isLoading: isPending,
          onSelectGym: setSelectedGymId,
          onClearFilters: clearFilters,
        };

  useEffect(() => {
    if (selectedGymId !== null && !gyms.find((g) => g.id === selectedGymId)) {
      setSelectedGymId(null);
    }
  }, [gyms, selectedGymId]);

  return (
    <View className="flex-1">
      <NaverMapView
        style={{ flex: 1 }}
        initialCamera={
          initialLocation !== null
            ? {
                latitude: initialLocation.latitude,
                longitude: initialLocation.longitude,
                zoom: INITIAL_ZOOM,
              }
            : undefined
        }
        onCameraIdle={handleCameraIdle}
      >
        {visibleMarkerIds.map((gymId) => {
          const gym = gyms.find((g) => g.id === gymId);
          if (!gym) return null;
          return (
            <GymMarker
              key={gymId}
              gymId={gymId}
              latitude={gym.latitude}
              longitude={gym.longitude}
              machineCount={gym.machine_count}
              isSelected={gymId === selectedGymId}
              isMismatch={gym.machine_count === 0}
              onPress={() => {
                setSelectedGymId(gymId);
              }}
            />
          );
        })}
      </NaverMapView>

      <View className="absolute top-safe-or-4 left-0 right-0 z-10">
        <FilterBar
          brands={brands}
          categories={categories}
          filters={filters}
          onBrandChange={setBrand}
          onCategoryChange={setCategory}
        />
      </View>

      <View className="absolute top-safe-or-16 left-0 right-0 z-10 items-center">
        <SearchAreaButton visible={showSearchButton} onPress={handleSearch} />
      </View>

      <View className="absolute bottom-0 left-0 right-0">
        <GymBottomSheet mode={bottomSheetMode} />
      </View>
    </View>
  );
}
