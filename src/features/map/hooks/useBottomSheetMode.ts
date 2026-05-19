import { useEffect, useState } from 'react';

import type { UnregisteredPlace } from '@/shared/generated/model';
import type { Coordinate } from '@/shared/hooks/useCurrentLocation';
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
  /** F7 NL search Naver merge — passed through to the list mode. Bottom sheet
   * interleaves these with `gyms` ordered by distance. */
  unregisteredPlaces?: readonly UnregisteredPlace[];
  onUnregisteredPress?: (place: UnregisteredPlace) => void;
}

interface UseBottomSheetModeResult {
  mode: GymBottomSheetMode;
  selectedGymId: string | null;
  setSelectedGymId: (id: string | null) => void;
}

export function useBottomSheetMode({
  gyms,
  isPending,
  userLocation,
  clearFilters,
  onPressMachine,
  nlEmpty,
  unregisteredPlaces,
  onUnregisteredPress,
}: UseBottomSheetModeParams): UseBottomSheetModeResult {
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);

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

  function handlePressMachine(machineId: string) {
    if (selectedGymId === null) return;
    onPressMachine(selectedGymId, machineId);
  }

  const mode: GymBottomSheetMode =
    selectedGym !== null
      ? {
          type: 'detail',
          selectedGym,
          onCloseDetail: () => {
            setSelectedGymId(null);
          },
          onPressMachine: handlePressMachine,
        }
      : {
          type: 'list',
          gyms,
          userLocation,
          isLoading: isPending,
          onSelectGym: setSelectedGymId,
          onClearFilters: clearFilters,
          unregisteredPlaces,
          onUnregisteredPress,
          nlEmpty,
        };

  return { mode, selectedGymId, setSelectedGymId };
}
