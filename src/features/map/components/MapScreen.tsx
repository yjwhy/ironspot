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
import type { GymWithMachineCount } from '@/shared/types/database';

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
// Empirically, calling animateCameraTo right inside the mutation onSuccess
// races marker insertion on iOS; a one-frame defer is enough to let React
// commit the new overlays first.
const CAMERA_DEFER_MS = 50;

type GymsSource =
  | { readonly kind: 'filter' }
  | {
      readonly kind: 'nl';
      readonly query: string;
      readonly response: NlSearchResponse;
      // Mapped once at dispatch time so the marker pipeline gets a stable
      // reference. Re-mapping inside render churns `useMarkerReveal`'s effect
      // (deps `[gyms]`) and the stagger never finishes — markers stay hidden.
      readonly gyms: readonly GymWithMachineCount[];
    };

type GymsAction =
  | { readonly type: 'enter_filter_mode' }
  | { readonly type: 'nl_result'; readonly query: string; readonly response: NlSearchResponse };

function gymsSourceReducer(_state: GymsSource, action: GymsAction): GymsSource {
  switch (action.type) {
    case 'enter_filter_mode':
      return { kind: 'filter' };
    case 'nl_result':
      return {
        kind: 'nl',
        query: action.query,
        response: action.response,
        gyms: action.response.gyms.map(toGymWithMachineCount),
      };
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

  const displayedGyms = source.kind === 'nl' ? source.gyms : filterSearch.gyms;
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
        const { coordinates } = response.resolvedLocation;
        const lat = coordinates?.lat;
        const lng = coordinates?.lng;
        if (lat === undefined || lng === undefined) return;
        // Pan-only animation. Calling animateCameraTo right inside
        // onSuccess races marker insertion in @mj-studio/react-native-naver-map
        // on iOS — the new overlays end up never rendered. A one-frame
        // setTimeout is enough to let React commit them first.
        //
        // Zoom is intentionally NOT changed: zoom-changing camera
        // animations clear newly added marker overlays in the same
        // library (the marker mount races with the zoom-level transition).
        // The chip ("1km 이내") communicates the radius instead.
        setTimeout(() => {
          mapRef.current?.animateCameraTo({
            latitude: lat,
            longitude: lng,
            duration: CAMERA_ANIMATE_MS,
          });
        }, CAMERA_DEFER_MS);
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
        {nlSearch.validationError !== undefined ? (
          // 400 validation errors (e.g. "헬스장 검색만 가능해요…") surface
          // inline so the recovery example stays readable. Replaces the
          // earlier transient toast which truncated the example clause.
          // Takes precedence over the success chip so the user sees the
          // error before any stale prior result.
          <InterpretationChip
            text={nlSearch.validationError}
            tone="error"
            onClose={nlSearch.clearValidationError}
          />
        ) : source.kind === 'nl' ? (
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
