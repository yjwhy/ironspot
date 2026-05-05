import { NaverMapView } from '@mj-studio/react-native-naver-map';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { GymBottomSheet } from '@/features/gym/components/GymBottomSheet';
import { GANGNAM_STATION, useCurrentLocation } from '@/shared/hooks/useCurrentLocation';

import { FilterButton } from './FilterButton';
import { FilterPanel } from './FilterPanel';
import { GymMarker } from './GymMarker';
import { SearchAreaButton } from './SearchAreaButton';
import { useBottomSheetMode } from '../hooks/useBottomSheetMode';
import { useBrands } from '../hooks/useBrands';
import { useCategories } from '../hooks/useCategories';
import { useFilters } from '../hooks/useFilters';
import { useMapSearch } from '../hooks/useMapSearch';
import { useMarkerReveal } from '../hooks/useMarkerReveal';

const INITIAL_ZOOM = 14;

export function MapScreen() {
  const router = useRouter();
  const locationState = useCurrentLocation();
  const { filters, setBrand, setCategory, clear: clearFilters } = useFilters();
  const { data: brands = [] } = useBrands();
  const { data: categories = [] } = useCategories();

  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const initialLocation = locationState.status !== 'loading' ? locationState.location : null;
  const userLocation = initialLocation ?? GANGNAM_STATION;

  const { gyms, isPending, showSearchButton, handleCameraIdle, handleSearch } =
    useMapSearch(filters);
  const { visibleMarkerIds } = useMarkerReveal(gyms);
  const {
    mode: bottomSheetMode,
    selectedGymId,
    setSelectedGymId,
  } = useBottomSheetMode({
    gyms,
    isPending,
    userLocation,
    clearFilters,
    onPressMachine: (gymId, machineId) => {
      router.push(`/gym/${gymId}/machine/${machineId}`);
    },
  });

  const activeFilterCount = [filters.brandId, filters.categoryId].filter(Boolean).length;

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
        onCameraIdle={(event) => {
          setFilterPanelOpen(false);
          handleCameraIdle(event);
        }}
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
              onPress={() => {
                setSelectedGymId(gymId);
              }}
            />
          );
        })}
      </NaverMapView>

      <View className="absolute top-safe-or-4 right-4 z-10">
        <FilterButton
          activeCount={activeFilterCount}
          onPress={() => {
            setFilterPanelOpen((prev) => !prev);
          }}
        />
      </View>

      <View className="absolute top-safe-or-16 left-0 right-0 z-20">
        <FilterPanel
          visible={filterPanelOpen}
          brands={brands}
          categories={categories}
          filters={filters}
          onBrandToggle={setBrand}
          onCategoryToggle={setCategory}
          onClose={() => {
            setFilterPanelOpen(false);
          }}
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
