import { NaverMapView } from '@mj-studio/react-native-naver-map';
import type { NaverMapViewRef } from '@mj-studio/react-native-naver-map';
import * as burnt from 'burnt';
import { useRouter } from 'expo-router';
import { useReducer, useRef } from 'react';
import { View } from 'react-native';

import { GymBottomSheet } from '@/features/gym/components/GymBottomSheet';
import { DirectionsOriginProvider } from '@/features/map/directions-origin-context';
import { InterpretationChip } from '@/features/search/components/InterpretationChip';
import { NlQuotaHint } from '@/features/search/components/NlQuotaHint';
import { PermissionDeniedBadge } from '@/features/search/components/PermissionDeniedBadge';
import { TopSearchBar } from '@/features/search/components/TopSearchBar';
import { useNlSearch } from '@/features/search/hooks/useNlSearch';
import { UPLOAD_PHOTO_PATHNAME } from '@/features/upload/constants';
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
  // Phase 5 item 23 follow-up (2026-05-22): FilterSheet now manages
  // chip/checkbox/AND-toggle state locally as `stagedFilters` and only
  // commits via `setAllFilters` when the user taps 필터 적용하기. The
  // individual `toggle*` setters and the per-key `setMachineFilterMode`
  // setter on useFilters stay available for non-sheet callers
  // (NL-search empty-state "조건 바꿔서 검색" path uses setAll directly
  // as well), so the hook API is unchanged — only MapScreen's
  // destructure shrinks.
  const { filters, hasActiveFilters, setAll: setAllFilters, clear: clearFilters } = useFilters();
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

  // Phase 5 item 23 removed the "tap = immediate POST /api/gyms" path
  // (and with it the createGym hook usage on this screen, the race lock,
  // the pending-id state, and the just-registered route params). The
  // unregistered flow now opens UnregisteredGymDetail in the BottomSheet
  // and only commits gym creation at first-photo-upload time via the
  // atomic POST /api/gym-machines endpoint.

  function handleRegisterUnregisteredGym(place: UnregisteredPlace) {
    // Phase 5 item 23 slice d: the old "tap = immediate POST /api/gyms" path
    // is gone. The CTA on UnregisteredGymDetail (and the legacy map-marker
    // tap, while still using this handler) now navigates straight to the
    // photo-capture screen with the Naver place data serialised onto the
    // route param. The gym itself is created server-side inside the same
    // transaction as the first photo upload (POST /api/gym-machines with
    // `naverPlace`, atomic per slice a). No more race lock, no more undo
    // toast — abandoning the flow leaves zero DB residue.
    router.push({
      pathname: UPLOAD_PHOTO_PATHNAME,
      params: { naverPlace: JSON.stringify(place) },
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
    onPressRegisterFirstPhoto: handleRegisterUnregisteredGym,
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

  // Phase 5 item 16 slice c: derive the NL-derived origin reference for the
  // DirectionsChip ActionSheet. The current ResolvedLocation DTO only
  // exposes coordinates + radiusKm, so the "named place" copy is generic
  // ("검색 위치에서"); a follow-up can surface a `name` field through the
  // backend response for the personable "강남역에서" label. The reference
  // is considered active only when NL is the source AND the resolved
  // coordinates differ meaningfully from the user's GPS — otherwise the
  // ActionSheet's two choices would point at the same place.
  const directionsReference = (() => {
    if (source.kind !== 'nl') return null;
    const coords = source.response.resolvedLocation.coordinates;
    if (coords?.lat === undefined || coords.lng === undefined) {
      return null;
    }
    const dLat = Math.abs(coords.lat - searchAnchor.latitude);
    const dLng = Math.abs(coords.lng - searchAnchor.longitude);
    // ~100m threshold so micro-GPS jitter never trips the prompt.
    if (dLat < 0.001 && dLng < 0.001) return null;
    return {
      id: `${String(coords.lat)}_${String(coords.lng)}`,
      name: '검색 위치',
      latitude: coords.lat,
      longitude: coords.lng,
    };
  })();

  return (
    <DirectionsOriginProvider reference={directionsReference}>
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
            <>
              <InterpretationChip
                text={source.response.interpretation}
                tone={isNlZeroResult ? 'zero' : 'success'}
                onClose={handleNlChipClose}
              />
              <NlQuotaHint used={source.response.quota.used} limit={source.response.quota.limit} />
            </>
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
          onApply={setAllFilters}
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
    </DirectionsOriginProvider>
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
