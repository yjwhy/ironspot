import { NaverMapView } from '@mj-studio/react-native-naver-map';
import type { NaverMapViewRef, Region } from '@mj-studio/react-native-naver-map';
import * as burnt from 'burnt';
import { useRouter } from 'expo-router';
import { useReducer, useRef, useState } from 'react';
import { View } from 'react-native';

import { GymBottomSheet } from '@/features/gym/components/GymBottomSheet';
import { InterpretationChip } from '@/features/search/components/InterpretationChip';
import { PermissionDeniedBadge } from '@/features/search/components/PermissionDeniedBadge';
import { TopSearchBar } from '@/features/search/components/TopSearchBar';
import { useNlSearch } from '@/features/search/hooks/useNlSearch';
import type { NlSearchResponse, ParsedFilters } from '@/shared/generated/model';
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
import { toGymWithMachineCount } from '../services/gym-search';

const INITIAL_ZOOM = 14;
const CAMERA_ANIMATE_MS = 500;

// Map radius (km) to a zoom level that frames the search circle reasonably.
// Empirical Naver Maps values: 0.5km≈16, 1km≈15, 2km≈14, 5km≈13.
function zoomForRadius(radiusKm: number): number {
  if (radiusKm <= 0.5) return 16;
  if (radiusKm <= 1) return 15;
  if (radiusKm <= 2) return 14;
  if (radiusKm <= 5) return 13;
  return 12;
}

type GymsSource =
  | { readonly kind: 'filter' }
  | { readonly kind: 'nl'; readonly query: string; readonly response: NlSearchResponse };

type GymsAction =
  | { readonly type: 'enter_filter_mode' }
  | { readonly type: 'nl_result'; readonly query: string; readonly response: NlSearchResponse };

function gymsSourceReducer(_state: GymsSource, action: GymsAction): GymsSource {
  switch (action.type) {
    case 'enter_filter_mode':
      return { kind: 'filter' };
    case 'nl_result':
      return { kind: 'nl', query: action.query, response: action.response };
  }
}

const INITIAL_SOURCE: GymsSource = { kind: 'filter' };

export function MapScreen() {
  const router = useRouter();
  const locationState = useCurrentLocation();
  const {
    filters,
    toggleBrand,
    toggleCategory,
    setAll: setAllFilters,
    clear: clearFilters,
  } = useFilters();
  const { data: brands = [], isError: brandsError } = useBrands();
  const { data: categories = [], isError: categoriesError } = useCategories();
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [source, dispatch] = useReducer(gymsSourceReducer, INITIAL_SOURCE);
  const mapRef = useRef<NaverMapViewRef>(null);

  const initialLocation = locationState.status !== 'loading' ? locationState.location : null;
  const userLocation = initialLocation ?? GANGNAM_STATION;
  const isPermissionDenied =
    locationState.status === 'fallback' && locationState.reason === 'permission_denied';

  const nlSearch = useNlSearch({
    userLat: userLocation.latitude,
    userLng: userLocation.longitude,
  });
  const filterSearch = useMapSearch(filters);

  // NL response uses the camelCase Orval shape; the rest of the map pipeline
  // (markers, bottom sheet) expects the snake_case mapped shape, so apply the
  // same adapter the filter path goes through.
  const displayedGyms =
    source.kind === 'nl' ? source.response.gyms.map(toGymWithMachineCount) : filterSearch.gyms;
  const isPending = source.kind === 'nl' ? nlSearch.isPending : filterSearch.isPending;
  const showSearchButton = source.kind === 'filter' && filterSearch.showSearchButton;
  const isNlZeroResult = source.kind === 'nl' && source.response.totalCount === 0;

  const { visibleMarkerIds } = useMarkerReveal(displayedGyms);
  const {
    mode: bottomSheetMode,
    selectedGymId,
    setSelectedGymId,
  } = useBottomSheetMode({
    gyms: displayedGyms,
    isPending,
    userLocation,
    clearFilters,
    onPressMachine: (gymId, machineId) => {
      router.push(`/gym/${gymId}/machine/${machineId}`);
    },
    nlEmpty:
      source.kind === 'nl' && source.response.totalCount === 0
        ? {
            subtitle: `${source.response.interpretation}에 해당하는 곳이 없어요`,
            onRelaxFilters: handleRelaxFilters,
          }
        : undefined,
  });

  const activeFilterCount = filters.brandIds.length + filters.categoryIds.length;

  function handleCameraIdleWithPanelClose({ region }: { region: Region }) {
    setFilterPanelOpen(false);
    filterSearch.handleCameraIdle({ region });
  }

  function handleNlSubmit(query: string) {
    nlSearch.mutate(query, {
      onSuccess: (response) => {
        dispatch({ type: 'nl_result', query, response });
        setFilterPanelOpen(false);
        const { coordinates, radiusKm } = response.resolvedLocation;
        if (
          coordinates?.lat !== undefined &&
          coordinates.lng !== undefined &&
          radiusKm !== undefined
        ) {
          mapRef.current?.animateCameraTo({
            latitude: coordinates.lat,
            longitude: coordinates.lng,
            zoom: zoomForRadius(radiusKm),
            duration: CAMERA_ANIMATE_MS,
          });
        }
      },
    });
  }

  function handleNlChipClose() {
    dispatch({ type: 'enter_filter_mode' });
  }

  function handleRelaxFilters() {
    if (source.kind !== 'nl') return;
    applyParsedFiltersAndExitNl(source.response.parsedFilters);
  }

  function applyParsedFiltersAndExitNl(parsed: ParsedFilters) {
    setAllFilters({
      brandIds: parsed.brandIds,
      categoryIds: parsed.categoryIds,
      loadingType: null,
    });
    dispatch({ type: 'enter_filter_mode' });
    setFilterPanelOpen(true);
    surfaceDroppedConditions(parsed);
  }

  return (
    <View className="flex-1">
      <NaverMapView
        ref={mapRef}
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
        onCameraIdle={handleCameraIdleWithPanelClose}
      >
        {visibleMarkerIds.map((gymId) => {
          const gym = displayedGyms.find((g) => g.id === gymId);
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

      <View className="absolute top-safe-or-2 left-0 right-0 z-20 px-4 gap-2">
        {isPermissionDenied ? <PermissionDeniedBadge /> : null}
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <TopSearchBar onSubmit={handleNlSubmit} isPending={nlSearch.isPending} />
          </View>
          <FilterButton
            activeCount={activeFilterCount}
            onPress={() => {
              setFilterPanelOpen((prev) => !prev);
            }}
          />
        </View>
        {source.kind === 'nl' ? (
          <InterpretationChip
            text={source.response.interpretation}
            tone={isNlZeroResult ? 'zero' : 'success'}
            onClose={handleNlChipClose}
          />
        ) : null}
      </View>

      <View className="absolute top-safe-or-32 left-0 right-0 z-40">
        <FilterPanel
          visible={filterPanelOpen}
          brands={brands}
          categories={categories}
          brandsError={brandsError}
          categoriesError={categoriesError}
          selectedBrandIds={filters.brandIds}
          selectedCategoryIds={filters.categoryIds}
          onBrandToggle={toggleBrand}
          onCategoryToggle={toggleCategory}
          onClose={() => {
            setFilterPanelOpen(false);
          }}
        />
      </View>

      <View
        className="absolute left-0 right-0 z-10 items-center"
        style={{ top: '35%' }}
        pointerEvents="box-none"
      >
        <SearchAreaButton visible={showSearchButton} onPress={filterSearch.handleSearch} />
      </View>

      <View className="absolute bottom-0 left-0 right-0">
        <GymBottomSheet mode={bottomSheetMode} />
      </View>
    </View>
  );
}

function surfaceDroppedConditions(parsed: ParsedFilters) {
  const dropped: string[] = [];
  if (parsed.templateIds.length > 0) dropped.push('머신 이름');
  if (parsed.minCount !== undefined && parsed.minCount > 1) {
    dropped.push('최소 수량');
  }
  if (parsed.scope === 'combined') {
    dropped.push('동시 보유 조건');
  }
  if (dropped.length > 0) {
    burnt.toast({
      title: `${dropped.join(', ')} 조건은 적용되지 않아요`,
      preset: 'none',
      duration: 4,
    });
  }
}
