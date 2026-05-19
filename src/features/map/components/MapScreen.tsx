import { NaverMapView } from '@mj-studio/react-native-naver-map';
import type { NaverMapViewRef } from '@mj-studio/react-native-naver-map';
import * as burnt from 'burnt';
import { useRouter } from 'expo-router';
import { useReducer, useRef } from 'react';
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
import { FilterSheet, type FilterSheetRef } from './FilterSheet';
import { GymMarker } from './GymMarker';
import { SearchAreaButton } from './SearchAreaButton';
import { UnregisteredMarker } from './UnregisteredMarker';
import { useBottomSheetMode } from '../hooks/useBottomSheetMode';
import { useBrands } from '../hooks/useBrands';
import { useCategories } from '../hooks/useCategories';
import { useFilters } from '../hooks/useFilters';
import { useMachineTemplates } from '../hooks/useMachineTemplates';
import { useMapSearch } from '../hooks/useMapSearch';
import { useMarkerReveal } from '../hooks/useMarkerReveal';
import { scopeToMachineFilterMode } from '../lib/active-filters';
import { INITIAL_MAP_ZOOM, clampToKoreaBbox, planNlCamera } from '../lib/cameraUtils';
import { toGymWithMachineCount } from '../services/gym-search';

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
    hasActiveFilters,
    toggleBrand,
    toggleCategory,
    toggleTemplate,
    setMachineFilterMode,
    setAll: setAllFilters,
    clear: clearFilters,
  } = useFilters();
  const { data: brands = [], isError: brandsError } = useBrands();
  const { data: categories = [], isError: categoriesError } = useCategories();
  const { data: machineTemplates = [], isError: machineTemplatesError } = useMachineTemplates();
  const filterSheetRef = useRef<FilterSheetRef>(null);
  const [source, dispatch] = useReducer(gymsSourceReducer, INITIAL_SOURCE);
  const mapRef = useRef<NaverMapViewRef>(null);

  // Phase 5 item 13: clamp the first camera to Korea so the rare overseas
  // tester (and any spoofed GPS) never lands the map outside the launch
  // cohort's bbox. Subsequent NL searches then never cross a long-distance
  // jump unless the user really is overseas (handled by planNlCamera's
  // cinematic bypass).
  const initialLocation =
    locationState.status !== 'loading' ? clampToKoreaBbox(locationState.location) : null;
  // NL search origin + cinematic-bypass anchor. Falls back to 강남역 while
  // the GPS resolves so the search request always has a coordinate to bias
  // results around.
  const searchAnchor = initialLocation ?? GANGNAM_STATION;
  const isPermissionDenied =
    locationState.status === 'fallback' && locationState.reason === 'permission_denied';

  const nlSearch = useNlSearch({
    userLat: searchAnchor.latitude,
    userLng: searchAnchor.longitude,
  });
  const filterSearch = useMapSearch(filters);

  const displayedGyms = source.kind === 'nl' ? source.gyms : filterSearch.gyms;
  const isPending = source.kind === 'nl' ? nlSearch.isPending : filterSearch.isPending;
  const showSearchButton = source.kind === 'filter' && filterSearch.showSearchButton;
  const isNlZeroResult = source.kind === 'nl' && source.response.totalCount === 0;

  const { visibleMarkerIds } = useMarkerReveal(displayedGyms);
  // F7 NL search Naver merge — unregisteredPlaces only flows in NL mode. In
  // filter mode the backend doesn't run the Naver merge so the array is empty.
  const unregisteredPlaces = source.kind === 'nl' ? source.response.unregisteredPlaces : undefined;

  function handleUnregisteredPress(place: { name: string }) {
    // Deep-link to the upload flow with the Naver place pre-filled so the
    // user can become the first registrant (F7 product flow). Shared by the
    // bottom-sheet UnregisteredGymCard tap and the map UnregisteredMarker tap.
    router.push({
      pathname: '/(upload)/gym-select',
      params: { openNewGym: '1', initialQuery: place.name },
    });
  }

  const {
    mode: bottomSheetMode,
    selectedGymId,
    setSelectedGymId,
  } = useBottomSheetMode({
    gyms: displayedGyms,
    isPending,
    userLocation: searchAnchor,
    clearFilters,
    hasActiveFilters,
    onPressMachine: (gymId, machineId) => {
      router.push(`/gym/${gymId}/machine/${machineId}`);
    },
    unregisteredPlaces,
    onUnregisteredPress: handleUnregisteredPress,
    nlEmpty:
      source.kind === 'nl' &&
      source.response.totalCount === 0 &&
      source.response.unregisteredPlaces.length === 0
        ? {
            subtitle: `${source.response.interpretation}에 해당하는 곳이 없어요`,
            onRelaxFilters: handleRelaxFilters,
          }
        : undefined,
  });

  function handleNlSubmit(query: string) {
    nlSearch.mutate(query, {
      onSuccess: (response) => {
        dispatch({ type: 'nl_result', query, response });
        filterSheetRef.current?.dismiss();
        // Phase 5 item 13: planNlCamera threads `resolvedLocation.radiusKm`
        // into the camera zoom and picks the instant-snap path for
        // overseas → Korea jumps so the SDK's cinematic transition (which
        // would otherwise drop the target zoom) never fires. The deferMs
        // gives React one frame to commit the new markers before the
        // animation races their mount.
        const plan = planNlCamera(searchAnchor, response.resolvedLocation);
        if (plan === null) return;
        setTimeout(() => {
          mapRef.current?.animateCameraTo({
            latitude: plan.target.latitude,
            longitude: plan.target.longitude,
            zoom: plan.zoom,
            duration: plan.duration,
          });
        }, plan.deferMs);
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
    // ADR 0022 / Slice 45h: NL → structured filter 완전 매핑. templateIds 와
    // scope 가 이제 structured filter 의 1차 시민이므로 lossless 변환 가능.
    setAllFilters({
      brandIds: parsed.brandIds,
      categoryIds: parsed.categoryIds,
      templateIds: parsed.templateIds,
      machineFilterMode: scopeToMachineFilterMode(parsed.scope),
    });
    dispatch({ type: 'enter_filter_mode' });
    filterSheetRef.current?.present();
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
                zoom: INITIAL_MAP_ZOOM,
              }
            : undefined
        }
        onCameraIdle={filterSearch.handleCameraIdle}
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
        {unregisteredPlaces?.map((place) => (
          <UnregisteredMarker
            key={`naver:${place.naverPlaceId}`}
            naverPlaceId={place.naverPlaceId}
            latitude={place.latitude}
            longitude={place.longitude}
            onPress={() => {
              handleUnregisteredPress(place);
            }}
          />
        ))}
      </NaverMapView>

      <View className="absolute top-safe-or-2 left-0 right-0 z-20 px-4 gap-2">
        {isPermissionDenied ? <PermissionDeniedBadge /> : null}
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <TopSearchBar onSubmit={handleNlSubmit} isPending={nlSearch.isPending} />
          </View>
          <FilterButton
            activeCount={
              filters.brandIds.length + filters.categoryIds.length + filters.templateIds.length
            }
            onPress={() => {
              filterSheetRef.current?.present();
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

      <FilterSheet
        ref={filterSheetRef}
        brands={brands}
        categories={categories}
        machineTemplates={machineTemplates}
        brandsError={brandsError}
        categoriesError={categoriesError}
        machineTemplatesError={machineTemplatesError}
        filters={filters}
        onToggleBrand={toggleBrand}
        onToggleCategory={toggleCategory}
        onToggleTemplate={toggleTemplate}
        onSetMachineFilterMode={setMachineFilterMode}
        onResetAll={clearFilters}
      />

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
  // ADR 0022 / Slice 45h: templateIds + scope (combined → AND 토글) 이 이제
  // structured filter 에서 lossless 매핑 → toast 항목 제거. minCount > 1 만
  // 여전히 매핑 안 됨 (structured filter 가 minCount 차원 미지원).
  const dropped: string[] = [];
  if (parsed.minCount !== undefined && parsed.minCount > 1) {
    dropped.push('최소 수량');
  }
  if (dropped.length > 0) {
    burnt.toast({
      title: `${dropped.join(', ')} 조건은 적용되지 않아요`,
      preset: 'none',
      duration: 4,
    });
  }
}
