import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import type { Coordinate } from '@/shared/hooks/useCurrentLocation';
import type { GymWithMachineCount } from '@/shared/types/database';

import type { GymBottomSheetMode } from '../../gym/components/GymBottomSheet';

interface UseBottomSheetModeParams {
  gyms: readonly GymWithMachineCount[];
  isPending: boolean;
  userLocation: Coordinate;
  clearFilters: () => void;
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
}: UseBottomSheetModeParams): UseBottomSheetModeResult {
  const router = useRouter();
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);

  useEffect(
    function clearStaleSelectedGym() {
      if (selectedGymId !== null && !gyms.find((g) => g.id === selectedGymId)) {
        setSelectedGymId(null);
      }
    },
    [gyms, selectedGymId],
  );

  const selectedGym =
    selectedGymId !== null ? (gyms.find((g) => g.id === selectedGymId) ?? null) : null;

  function handlePressMachine(gymMachineId: string) {
    if (selectedGymId === null) return;
    router.push(`/gym/${selectedGymId}/machine/${gymMachineId}`);
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
        };

  return { mode, selectedGymId, setSelectedGymId };
}
