import { NaverMapView } from '@mj-studio/react-native-naver-map';
import type { NaverMapViewRef } from '@mj-studio/react-native-naver-map';
import * as burnt from 'burnt';
import { useRouter } from 'expo-router';
import { useReducer, useRef, useState } from 'react';
import { View } from 'react-native';

import { GymBottomSheet } from '@/features/gym/components/GymBottomSheet';
import { InterpretationChip } from '@/features/search/components/InterpretationChip';
import { PermissionDeniedBadge } from '@/features/search/components/PermissionDeniedBadge';
import { TopSearchBar } from '@/features/search/components/TopSearchBar';
import { useNlSearch } from '@/features/search/hooks/useNlSearch';
import { UPLOAD_PHOTO_PATHNAME } from '@/features/upload/constants';
import { useCreateGym } from '@/features/upload/hooks/useCreateGym';
import type { NlSearchResponse, ParsedFilters, UnregisteredPlace } from '@/shared/generated/model';
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

  // Phase 5 item 14: track which unregistered place is currently being
  // optimistically registered so the matching bottom-sheet card renders its
  // "등록 중..." pending state. We clear `lastPressedUnregisteredPlaceId` on
  // both onSuccess and onError so the underlying state stays truthful, and
  // ALSO gate the derived `pendingUnregisteredPlaceId` behind `isPending` as
  // belt-and-braces (covers any race where React batches the clear after a
  // re-render of the bottom sheet).
  const [lastPressedUnregisteredPlaceId, setLastPressedUnregisteredPlaceId] = useState<
    string | null
  >(null);
  // Phase 5 hotfix: real-device + sim both observed firing useCreateGym
  // TWICE on a single unregistered-card tap (two parallel POST /api/gyms,
  // one commits, the other cancels mid-request). Root cause: the React
  // state guard (`isCreatingGymFromUnregisteredPlace`) updates one tick
  // after `mutation.mutate` and a second touch event from RN Pressable
  // (or the UnregisteredMarker tap propagating from the map view) slips
  // through before isPending becomes true. Backend handles dedup on
  // naverPlaceId so the second POST returns the same gym, but the
  // cancelled one's onError fires burnt's "등록 실패" toast — the user
  // sees an error toast even though a gym row got created. useRef-based
  // lock blocks re-entry synchronously, no React-state round-trip.
  const createGymInFlightRef = useRef(false);
  const createGym = useCreateGym({
    onSuccess: (gym) => {
      // Phase 5 item 14a: land the user directly on the camera so the gym
      // they just registered as the first contributor flows straight into
      // the photo-upload + machine-pick path (item 11 slice 3 picker takes
      // it from there). The previous gym-select intermediate step was only
      // useful while POST /api/gym-machines was still pending — now that
      // item 11 has shipped, that step is pure friction.
      //
      // Phase 5 item 14b: thread the just-registered gym's id + name
      // into the camera route so UploadPhotoScreen can surface a 5s undo
      // toast (DELETE /api/gyms/{id} from item 14a). Other entry points
      // (FAB, gym-detail) push without these params so the toast stays
      // scoped to the unregistered-card-tap path where the footgun lives.
      setLastPressedUnregisteredPlaceId(null);
      createGymInFlightRef.current = false;
      router.push({
        pathname: UPLOAD_PHOTO_PATHNAME,
        params: {
          gymId: gym.id,
          justRegisteredGymId: gym.id,
          justRegisteredGymName: gym.name,
        },
      });
    },
    onError: () => {
      setLastPressedUnregisteredPlaceId(null);
      createGymInFlightRef.current = false;
    },
  });
  const isCreatingGymFromUnregisteredPlace = createGym.isPending;
  const pendingUnregisteredPlaceId = isCreatingGymFromUnregisteredPlace
    ? lastPressedUnregisteredPlaceId
    : null;

  function handleRegisterUnregisteredGym(place: UnregisteredPlace) {
    // Phase 5 item 14: optimistic create + skip the duplicate Naver-search.
    // Named for the action (mutation + navigate), not the event source —
    // both the bottom-sheet UnregisteredGymCard tap and the map
    // UnregisteredMarker tap route here.
    // Hotfix 2026-05-21: `createGymInFlightRef` is a synchronous re-entry
    // lock that blocks the double-tap race the React-state guard couldn't
    // catch (see hook declaration above for the root-cause writeup).
    // `isCreatingGymFromUnregisteredPlace` is kept as a belt-and-braces
    // visual gate; ref check fires first.
    if (createGymInFlightRef.current) return;
    if (isCreatingGymFromUnregisteredPlace) return;
    createGymInFlightRef.current = true;
    setLastPressedUnregisteredPlaceId(place.naverPlaceId);
    createGym.handleCreateGymFromUnregisteredPlace(place);
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
    onUnregisteredPress: handleRegisterUnregisteredGym,
    pendingUnregisteredPlaceId,
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
              handleRegisterUnregisteredGym(place);
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
