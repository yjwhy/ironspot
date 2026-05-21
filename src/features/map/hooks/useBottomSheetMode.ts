import { useEffect, useState } from 'react';

import type { UnregisteredPlace } from '@/shared/generated/model';
import type { Coordinate } from '@/shared/hooks/useCurrentLocation';
import { haversineKm } from '@/shared/lib/geo';
import type { GymWithMachineCount } from '@/shared/types/database';

import type { GymBottomSheetMode } from '../../gym/types';

interface UseBottomSheetModeParams {
  gyms: readonly GymWithMachineCount[];
  isPending: boolean;
  userLocation: Coordinate;
  clearFilters: () => void;
  onPressMachine: (gymId: string, machineId: string) => void;
  /** Optional NL Search empty-state action wired through to the bottom sheet. */
  nlEmpty?: {
    subtitle: string;
    onRelaxFilters: () => void;
  };
  /**
   * Phase 5 item 20: branches the empty-state copy when `gyms` is empty.
   * See `GymBottomSheetMode.list.hasActiveFilters` for the policy.
   */
  hasActiveFilters?: boolean;
  /** F7 NL search Naver merge — passed through to the list mode. Bottom sheet
   * interleaves these with `gyms` ordered by distance. */
  unregisteredPlaces?: readonly UnregisteredPlace[];
  /**
   * Phase 5 item 23 (slice c): tapped from the bottom-sheet unregistered
   * card. This hook now treats the tap as a "select for detail" action and
   * switches the sheet into `unregistered-detail` mode; the CTA on that
   * detail screen is what drives the actual first-photo / register flow
   * (wired by the caller via `onPressRegisterFirstPhoto`).
   */
  onPressRegisterFirstPhoto: (place: UnregisteredPlace) => void;
}

interface UseBottomSheetModeResult {
  mode: GymBottomSheetMode;
  selectedGymId: string | null;
  setSelectedGymId: (id: string | null) => void;
  selectedUnregisteredPlace: UnregisteredPlace | null;
  setSelectedUnregisteredPlace: (place: UnregisteredPlace | null) => void;
}

export function useBottomSheetMode({
  gyms,
  isPending,
  userLocation,
  clearFilters,
  onPressMachine,
  nlEmpty,
  hasActiveFilters,
  unregisteredPlaces,
  onPressRegisterFirstPhoto,
}: UseBottomSheetModeParams): UseBottomSheetModeResult {
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const [selectedUnregisteredPlace, setSelectedUnregisteredPlace] =
    useState<UnregisteredPlace | null>(null);

  const selectedGym =
    selectedGymId !== null ? (gyms.find((g) => g.id === selectedGymId) ?? null) : null;

  useEffect(
    function clearStaleSelectedGym() {
      if (selectedGymId !== null && selectedGym === null) {
        setSelectedGymId(null);
      }
    },
    [selectedGymId, selectedGym],
  );

  // Drop a stale unregistered selection when its naverPlaceId is no longer
  // in the current results (e.g. user moved the map / re-ran search).
  useEffect(
    function clearStaleUnregisteredSelection() {
      if (selectedUnregisteredPlace === null) return;
      const stillPresent = unregisteredPlaces?.some(
        (p) => p.naverPlaceId === selectedUnregisteredPlace.naverPlaceId,
      );
      if (!stillPresent) {
        setSelectedUnregisteredPlace(null);
      }
    },
    [selectedUnregisteredPlace, unregisteredPlaces],
  );

  function handlePressMachine(machineId: string) {
    if (selectedGymId === null) return;
    onPressMachine(selectedGymId, machineId);
  }

  function buildListMode(): GymBottomSheetMode {
    return {
      type: 'list',
      gyms,
      userLocation,
      isLoading: isPending,
      onSelectGym: setSelectedGymId,
      onClearFilters: clearFilters,
      hasActiveFilters: hasActiveFilters ?? false,
      unregisteredPlaces,
      onUnregisteredPress: setSelectedUnregisteredPlace,
      nlEmpty,
    };
  }

  let mode: GymBottomSheetMode;
  if (selectedGym !== null) {
    mode = {
      type: 'detail',
      selectedGym,
      onCloseDetail: () => {
        setSelectedGymId(null);
      },
      onPressMachine: handlePressMachine,
    };
  } else if (selectedUnregisteredPlace !== null) {
    mode = {
      type: 'unregistered-detail',
      place: selectedUnregisteredPlace,
      distanceKm: haversineKm(userLocation, {
        latitude: selectedUnregisteredPlace.latitude,
        longitude: selectedUnregisteredPlace.longitude,
      }),
      onCloseDetail: () => {
        setSelectedUnregisteredPlace(null);
      },
      onPressRegisterFirstPhoto,
    };
  } else {
    mode = buildListMode();
  }

  return {
    mode,
    selectedGymId,
    setSelectedGymId,
    selectedUnregisteredPlace,
    setSelectedUnregisteredPlace,
  };
}
